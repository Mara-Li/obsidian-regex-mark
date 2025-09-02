import type { Extension } from "@codemirror/state";
import { Plugin } from "obsidian";

import { cmExtension } from "./cmPlugin";
import { SettingOptions } from "./model";
import { MarkdownProcessor } from "./markdownProcessor";
import { RemarkRegexSettingTab } from "./settings";

export default class RegexMark extends Plugin {
	settings: SettingOptions;
	extensions: Extension[] = [];

	async onload() {
		console.log("loading plugin RegexMark");
		await this.loadSettings();
		this.addSettingTab(new RemarkRegexSettingTab(this.app, this));
		this.registerMarkdownPostProcessor((element: HTMLElement) => {
			MarkdownProcessor(this.settings.mark, element, this.app);
		});
		this.updateCmExtension();
		this.registerEditorExtension(this.extensions);
	}

	onunload() {
		console.log("unloading plugin RegexMark");
	}

	async loadSettings() {
		const settingsData = await this.loadData();
		this.settings = SettingOptions.from(settingsData, this);
		this.settings.addOnChange(() => this.applyChanges());
	}

	async applyChanges() {
		this.updateCmExtension();
		await this.saveSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings.serialize());
	}

	updateCmExtension() {
		this.extensions = cmExtension(this);
		this.app.workspace.updateOptions();
	}
}
