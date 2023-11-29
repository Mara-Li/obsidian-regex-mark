import { RegExpCursor } from "@codemirror/search";
import { combineConfig,EditorSelection, Extension, Facet } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginSpec,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { cloneDeep } from "lodash";

import RegexMark from "./main";
import { SettingOption,SettingOptions } from "./setting";
import { isValidRegex, removeTags } from "./utils";

const Config = Facet.define<SettingOptions, Required<SettingOptions>>({
	combine(options) {
		return combineConfig(options, []);
	},
});

export function cmExtension(plugin: RegexMark) {
	const extensions: Extension[] = [ cmPlugin ];
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
		if (update.docChanged || update.viewportChanged || update.selectionSet) {
			this.decorations = this.buildDecorations(update.view);
		}
	}

	buildDecorations(view: EditorView) {
		const decorations = [];
		const data: SettingOptions = Object.values(view.state.facet(Config));
		for (const part of view.visibleRanges) {
			for (const d of data) {
				if (!d.regex || !d.class || d.regex === "" || d.class === "" || !isValidRegex(d.regex))
					continue;
				const cursor = new RegExpCursor(view.state.doc, removeTags(d.regex), {}, part.from, part.to);
				while (!cursor.next().done) {
					const { from, to } = cursor.value;
					//don't add the decoration if the cursor (selection in the editor) is inside the decoration
					if (checkSelectionOverlap(view.state.selection, from, to))
					{
						//just apply the decoration to the whole line
						const markup = Decoration.mark({ class: d.class });
						decorations.push(markup.range(from, to));
						continue;
					}
					const string = view.state.sliceDoc(from, to).trim();
					const markDeco = Decoration.replace({
						widget: new LivePreviewWidget(string, d, view),
					});
					decorations.push(markDeco.range(from, to));



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
	data : SettingOption;
	view: EditorView;
	constructor(readonly value: string, data: SettingOption, view: EditorView) {
		super();
		this.data = data;
		this.view = view;
	}

	//Widget is only updated when the raw text is changed / the elements get focus and loses it

	eq(other: LivePreviewWidget) {
		//return false if the regex is edited
		const regex = new RegExp(removeTags(this.data.regex), "g");
		if (this.value.match(regex) === null)
			return false;

		return other.value == this.value;
	}


	toDOM() {
		const wrap = document.createElement("span");
		wrap.addClass(this.data.class);
		const text = this.value;
		if (this.data.hide){
			//example of hiding:
			//entry : __content__ => <span class="underline"><span class="cm-hide">__</span>content<span class="cm-hide">__</span></span>
			//regex : {{open:__}}(.*){{close:__}}
			let openTag = null;
			let closeTag = null;
			if (this.data.regex.match("{{open"))
				openTag = this.data.regex.match(/{{open:(.*?)}}/)?.[1];
			if (this.data.regex.match("{{close"))
				closeTag = this.data.regex.match(/{{close:(.*?)}}/)?.[1];

			const newContent = wrap.createEl("span");
			//replace the regex open tag with the actual open tag
			const openRegex = new RegExp(openTag as string, "g");
			const closeRegex = new RegExp(closeTag as string, "g");
			//use createEl to:
			// - replace the openRegex with <span class="cm-hide">openTag</span>
			// - replace the closeRegex with <span class="cm-hide">closeTag</span>
			// - replace the text with <span class="data.class">text</span>
			// result : <span class="cm-hide">openTag</span><span class="data.class">text</span><span class="cm-hide">closeTag</span>
			//BUG : cursor is not placed correctly when the text is selected

			newContent.createEl("span", { cls: "cm-hide" }).setText(text.match(openRegex)?.[1] || "");
			newContent.createEl("span", { cls: this.data.class }).setText(text.replace(openRegex, "").replace(closeRegex, "") || "");
			newContent.createEl("span", { cls: "cm-hide" }).setText(text.match(closeRegex)?.[1] || "");

			//edit the from & to position of the cursor

		} else
			wrap.innerText = text;
		return wrap;
	}



}

function checkSelectionOverlap(selection: EditorSelection | undefined, from: number, to: number): boolean {
	if (!selection) {
		return false;
	}

	for (const range of selection.ranges) {
		if (range.to >= from && range.from <= to) {
			return true;
		}
	}

	return false;
}
