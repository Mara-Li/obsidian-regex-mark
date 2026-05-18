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
} from "@codemirror/view";
import { MarkRule, SettingOptions } from "./model";
import { Notice, sanitizeHTMLToDom } from "obsidian";
import type RegexMark from "./main";
import { substituteString } from "./utils";

interface ConfigWithPlugin {
	settings: SettingOptions;
	plugin: RegexMark;
}

const Config = Facet.define<{ settings: SettingOptions; plugin: RegexMark }, ConfigWithPlugin>({
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
	return [cmPlugin, Config.of({ plugin, settings: plugin.settings })];
}

class CMPlugin implements PluginValue {
	decorations: DecorationSet;
	private plugin: RegexMark;
	private compositionRange: { from: number; to: number } | null = null;
	view: EditorView;

	onCompositionstart: (a: HTMLElementEventMap[keyof HTMLElementEventMap]) => any;
	onCompositionupdate: (a: HTMLElementEventMap[keyof HTMLElementEventMap]) => any;
	onCompositionend: (a: HTMLElementEventMap[keyof HTMLElementEventMap]) => any;

	constructor(view: EditorView) {
		this.plugin = view.state.facet(Config).plugin;
		this.decorations = this.buildDecorations(view);
		this.view = view;

		this.view.dom.addEventListener(
			"compositionstart",
			(this.onCompositionstart = () => {
				const sel = this.view.state.selection.main;
				this.compositionRange = { from: sel.from, to: sel.to };
				this.decorations = this.buildDecorations(this.view);
			})
		);
		this.view.dom.addEventListener(
			"compositionupdate",
			(this.onCompositionupdate = () => {
				if (!this.compositionRange) return;
				this.compositionRange.to = this.view.state.selection.main.to;
				this.decorations = this.buildDecorations(this.view);
			})
		);
		this.view.dom.addEventListener(
			"compositionend",
			(this.onCompositionend = () => {
				this.compositionRange = null;
				this.decorations = this.buildDecorations(this.view);
			})
		);
	}

	destroy() {
		this.view.dom.removeEventListener("compositionstart", this.onCompositionstart);
		this.view.dom.removeEventListener("compositionupdate", this.onCompositionupdate);
		this.view.dom.removeEventListener("compositionend", this.onCompositionend);
	}

	update(update: ViewUpdate) {
		this.view = update.view;
		const configChanged = update.startState.facet(Config) !== update.state.facet(Config);
		const { settings } = update.state.facet(Config);
		const hasHideRules = settings.mark.some((d) => d.hide);
		if (
			update.docChanged ||
			update.viewportChanged ||
			configChanged ||
			(update.selectionSet && hasHideRules)
		) {
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

		const { settings } = view.state.facet(Config);
		const data: MarkRule[] = settings.mark;

		const mode = this.viewMode(view);
		for (const part of view.visibleRanges) {
			// Pre-compute code block ranges once per visible part if any active rule needs it.
			const needsBlockCheck = data.some((d) => !d.shouldSkip(mode) && d.viewMode?.codeBlock === false);
			const blockRanges = needsBlockCheck ? computeBlockRanges(view, part) : null;

			for (const d of data) {
				if (d.shouldSkip(mode)) continue;
				try {
					const cursor = new RegExpCursor(view.state.doc, d.regexString, {}, part.from, part.to);
					while (!cursor.next().done) {
						const { from, to, match } = cursor.value;

						if (this.compositionRange && from <= this.compositionRange.to && to >= this.compositionRange.from) {
							continue;
						}

						if (d.viewMode?.codeBlock === false && blockRanges && isInsideBlockRange(blockRanges, from, to)) {
							continue;
						}

						// Apply the main CSS class to the full match range.
						// Using Decoration.mark (instead of Decoration.replace/widget) preserves
						// Obsidian's markdown rendering inside the matched region.
						const markup = Decoration.mark({ class: substituteString(d.class, match) });
						decorations.push(markup.range(from, to));

						// Source mode: only the main class is needed.
						if (mode === "Source") continue;

						// Live Preview: also apply named group classes.
						if (match.indices?.groups) {
							for (const [name, indices] of Object.entries(match.indices.groups)) {
								if (indices) {
									// indices are relative to part.from; convert to absolute document positions.
									const groupFrom = from + indices[0] - match.index;
									const groupTo = from + indices[1] - match.index;
									decorations.push(Decoration.mark({ class: name }).range(groupFrom, groupTo));
								}
							}
						}

						// Live Preview with hide: hide open/close markers via cm-hide when the
						// cursor is not inside the matched range.
						if (d.hide && !checkSelectionOverlap(view.state.selection, from, to)) {
							const matchedText = view.state.sliceDoc(from, to);
							const { open: openPattern, close: closePattern } = d.patternSubRegex;

							if (openPattern) {
								const openMatch = openPattern.exec(matchedText);
								if (openMatch) {
									decorations.push(Decoration.mark({ class: "cm-hide" }).range(from, from + openMatch[0].length));
								}
							}

							if (closePattern) {
								const closeMatch = closePattern.exec(matchedText);
								if (closeMatch) {
									decorations.push(Decoration.mark({ class: "cm-hide" }).range(to - closeMatch[0].length, to));
								}
							}
						}
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

export const cmPlugin = ViewPlugin.fromClass(CMPlugin, pluginSpec);

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

function computeBlockRanges(
	view: EditorView,
	part: { from: number; to: number }
): Array<{ from: number; to: number }> {
	const blockRegex = /(```[\s\S]*?```|`[^`]*`)/g;
	const ranges: Array<{ from: number; to: number }> = [];
	const text = view.state.doc.sliceString(part.from, part.to);
	let m: RegExpExecArray | null;
	while ((m = blockRegex.exec(text)) !== null) {
		ranges.push({ from: m.index + part.from, to: blockRegex.lastIndex + part.from });
	}
	return ranges;
}

function isInsideBlockRange(ranges: Array<{ from: number; to: number }>, from: number, to: number): boolean {
	return ranges.some((r) => from >= r.from && to <= r.to);
}
