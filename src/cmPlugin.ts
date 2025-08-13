import { RegExpCursor } from "@codemirror/search";
import { combineConfig, type EditorSelection, type Extension, Facet } from "@codemirror/state";
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
import {MarkRule, Pattern, SettingOptions} from "./model";
import { Notice, sanitizeHTMLToDom } from "obsidian";
import type RegexMark from "./main";
import { applyRuleClasses } from "./utils";

interface ConfigWithPlugin {
  settings: SettingOptions,
	plugin: RegexMark;
}

const Config = Facet.define<{ settings: SettingOptions, plugin: RegexMark }, ConfigWithPlugin>({
	combine(options) {
		const combined = combineConfig(options, {});
		const plugin = options.findLast((opt) => "plugin" in opt)?.plugin;
    const settings = options.findLast((opt) => "settings" in opt)?.settings;

		return {
			...combined,
      plugin,
      settings,
		} as ConfigWithPlugin;
	},
});

export function cmExtension(plugin: RegexMark) {
	const extensions: Extension[] = [
    cmPlugin,
    Config.of({plugin, settings: plugin.settings})
  ];
	return extensions;
}

class CMPlugin implements PluginValue {
	decorations: DecorationSet;
	private plugin: RegexMark;

	constructor(view: EditorView) {
		this.plugin = view.state.facet(Config).plugin;
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

    const {settings, plugin} = view.state.facet(Config);
		const data: MarkRule[] = settings.mark;
		const pattern = settings._pattern;

		const mode = this.viewMode(view);
		for (const part of view.visibleRanges) {
			for (const d of data) {
				if (d.shouldSkip(mode))
					continue;
				try {
					const cursor = new RegExpCursor(view.state.doc, d.regexString, {}, part.from, part.to);
					while (!cursor.next().done) {
						const { from, to } = cursor.value;
						const insideBlock = disableInBlock(d, view, cursor, part, from, to);
						if (insideBlock) continue;

						//don't add the decoration if the cursor (selection in the editor) is inside the decoration
						if (checkSelectionOverlap(view.state.selection, from, to) || this.viewMode(view) === "Source") {
							//just apply the decoration to the whole line
							const markup = Decoration.mark({ class: d.class });
							decorations.push(markup.range(from, to));
							continue;
						}
						const string = view.state.sliceDoc(from, to);
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
	data: MarkRule;
	view: EditorView;
	pattern: Pattern;

	constructor(
		readonly value: string,
		data: MarkRule,
		view: EditorView,
		pattern: Pattern
	) {
		super();
		this.data = data;
		this.view = view;
		this.pattern = pattern;
	}

	//Widget is only updated when the raw text is changed / the elements get focus and loses it

	eq(other: LivePreviewWidget) {
		//return false if the regex is edited
		const regex = this.data.regex;
		if (this.value.match(regex) === null) return false;

		return other.value == this.value;
	}

	toDOM() {
		let wrap = document.createElement("span");
		const text = this.value;

    const regex = this.data.regex;
    const dataText = regex.exec(text);
    if (dataText) {
      wrap.append(
        applyRuleClasses(text, this.data, dataText,
          (substring) => `<span class="cm-hide">${substring}</span>`
        )
      )
      return wrap;
    } else {
      wrap.addClass(this.data.class);
      wrap.innerText = text;
      return wrap;
    }
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
	data: MarkRule,
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
	// biome-ignore lint/suspicious/noAssignInExpressions: Let blockRegex be reused
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
