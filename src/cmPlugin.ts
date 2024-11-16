import { RegExpCursor } from "@codemirror/search";
import { type EditorSelection, type Extension, Facet, combineConfig } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	type PluginSpec,
	type PluginValue,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { cloneDeep } from "lodash";

import { Notice, sanitizeHTMLToDom } from "obsidian";
import { DEFAULT_PATTERN, type Mark, type Pattern, type SettingOption, type SettingOptions } from "./interface";
import type RegexMark from "./main";
import { isValidRegex, removeTags } from "./utils";

const Config = Facet.define<SettingOptions, Required<SettingOptions>>({
	combine(options) {
		return combineConfig(options, {});
	},
});

export function cmExtension(plugin: RegexMark) {
	const extensions: Extension[] = [cmPlugin];
	const options = plugin.settings;
	extensions.push(Config.of(cloneDeep(options)));
	return extensions;
}

class CMPlugin implements PluginValue {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view);
	}

	update(update: ViewUpdate) {
		if (update) {
			this.decorations = this.buildDecorations(update.view);
		}
	}

	viewMode(view: EditorView) {
		const parent = view.dom.parentElement;
		if (parent?.classList.contains("is-live-preview")) return "Live";
		else return "Source";
	}

	buildDecorations(view: EditorView) {
		const decorations = [];
		const data: Mark = Object.values(view.state.facet(Config).mark);
		const pattern: Pattern = view.state.facet(Config).pattern ?? cloneDeep(DEFAULT_PATTERN);

		const mode = this.viewMode(view);
		for (const part of view.visibleRanges) {
			for (const d of data) {
				const displayMode = mode === "Live" ? d.viewMode?.live : d.viewMode?.source;
				if (
					!d.regex ||
					!d.class ||
					d.regex === "" ||
					d.class === "" ||
					!isValidRegex(d.regex, true, pattern) ||
					displayMode === false
				)
					continue;
				try {
					const cursor = new RegExpCursor(view.state.doc, removeTags(d.regex, pattern), {}, part.from, part.to);
					while (!cursor.next().done) {
						const { from, to } = cursor.value;
						const insideBlock = disableInBlock(d, view, cursor, part, from, to);
						if (insideBlock) continue;

						//don't add the decoration if the cursor (selection in the editor) is inside the decoration
						if (checkSelectionOverlap(view.state.selection, from, to)) {
							//just apply the decoration to the whole line
							const markup = Decoration.mark({ class: d.class });
							decorations.push(markup.range(from, to));
							continue;
						}
						const string = view.state.sliceDoc(from, to).trim();
						const markDeco = Decoration.replace({
							widget: new LivePreviewWidget(string, d, view, pattern),
						});
						decorations.push(markDeco.range(from, to));
					}
				} catch (e) {
					console.error(e);
					new Notice(sanitizeHTMLToDom(`<span class="error RegexMark"><code>${d.regex}</code>: <b>${e}</b></span>`));
				}
			}
		}
		return Decoration.set(decorations.sort((a, b) => a.from - b.from));
	}
}

const pluginSpec: PluginSpec<CMPlugin> = {
	decorations: (value: CMPlugin) => value.decorations,
};

const cmPlugin = ViewPlugin.fromClass(CMPlugin, pluginSpec);

class LivePreviewWidget extends WidgetType {
	data: SettingOption;
	view: EditorView;
	pattern: Pattern;

	constructor(
		readonly value: string,
		data: SettingOption,
		view: EditorView,
		pattern?: Pattern
	) {
		super();
		this.data = data;
		this.view = view;
		this.pattern = pattern ?? cloneDeep(DEFAULT_PATTERN);
	}

	//Widget is only updated when the raw text is changed / the elements get focus and loses it

	eq(other: LivePreviewWidget) {
		//return false if the regex is edited
		const regex = new RegExp(removeTags(this.data.regex, this.pattern));
		if (this.value.match(regex) === null) return false;

		return other.value == this.value;
	}

	constructTag(pattern: string) {
		const regex = new RegExp(pattern);
		return this.data.regex.match(regex)?.[1] ?? null;
	}

	toDOM() {
		const wrap = document.createElement("span");
		wrap.addClass(this.data.class);
		const text = this.value;
		if (this.data.hide) {
			const openTag = this.constructTag(this.pattern.open);
			const closeTag = this.constructTag(this.pattern.close);

			const newContent = wrap.createEl("span");
			if (
				(openTag && !isValidRegex(openTag as string, true, this.pattern)) ||
				(closeTag && !isValidRegex(closeTag as string, true, this.pattern))
			) {
				return wrap;
			}
			const openRegex = new RegExp(openTag as string, "g");
			const closeRegex = new RegExp(closeTag as string, "g");
			newContent.createEl("span", { cls: "cm-hide" }).setText(text.match(openRegex)?.[1] || "");
			newContent
				.createEl("span", { cls: this.data.class })
				.setText(text.replace(openRegex, "").replace(closeRegex, "") || "");
			newContent.createEl("span", { cls: "cm-hide" }).setText(text.match(closeRegex)?.[1] || "");
		} else wrap.innerText = text;

		return wrap;
	}

	ignoreEvent(_event: Event) {
		return false;
	}

	destroy(_dom: HTMLElement): void {
		//do nothing
	}
}

function checkSelectionOverlap(selection: EditorSelection | undefined, from: number, to: number): boolean {
	if (!selection) {
		return false;
	}

	for (const range of selection.ranges) {
		if (range.to >= from && range.from <= to) {
			return true;
		} //if text is not undefined, check if the selection is inside the text
	}

	return false;
}

function disableInBlock(
	data: SettingOption,
	view: EditorView,
	blockMatch: any,
	part: { from: number; to: number },
	from: number,
	to: number
) {
	if (data.viewMode?.codeBlock || data.viewMode?.codeBlock === undefined) return false;
	const blockRegex = /(```[\s\S]*?```|`[^`]*`)/g;
	let insideBlock = false;
	blockRegex.lastIndex = 0;
	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	while ((blockMatch = blockRegex.exec(view.state.doc.sliceString(part.from, part.to))) !== null) {
		const blockFrom = blockMatch.index + part.from;
		const blockTo = blockRegex.lastIndex + part.from;
		if (from >= blockFrom && to <= blockTo) {
			insideBlock = true;
			break;
		}
	}
	return insideBlock;
}
