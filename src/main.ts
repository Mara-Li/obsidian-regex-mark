import type { Extension } from "@codemirror/state";
import { Plugin } from "obsidian";

import { cmExtension } from "./cmPlugin";
import { MarkdownProcessor } from "./markdownProcessor";
import { SettingOptions } from "./model";
import { RemarkRegexSettingTab } from "./settings";

export default class RegexMark extends Plugin {
	declare settings: SettingOptions;
	extensions: Extension[] = [];

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new RemarkRegexSettingTab(this.app, this));
		this.registerMarkdownPostProcessor((element: HTMLElement) => {
			MarkdownProcessor(this.settings.mark, element, this.app);
		});
		this.updateCmExtension();
		this.registerEditorExtension(this.extensions);
	}

	async loadSettings() {
		const settingsData = (await this.loadData()) as Parameters<typeof SettingOptions.from>[0];
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
