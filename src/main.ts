import type { Extension } from "@codemirror/state";
import { Plugin } from "obsidian";

import { cmExtension } from "./cmPlugin";
import { SettingOptions } from "./model";
import { MarkdownProcessor } from "./markdownProcessor";
import { RemarkRegexSettingTab } from "./settings";

export default class RegexMark extends Plugin {
	settings: SettingOptions;
	extensions: Extension[];
	cmExtension: Extension;

	async onload() {
		console.log("loading plugin RegexMark");
		await this.loadSettings();
		/*const hasDisable = this.settings.mark.filter((data) => data.disable);
		for (const data of hasDisable) {
			if (data.disable) {
				console.warn(`Deprecated disable option found for ${data.class}, removing it and adjust the viewMode option.`);
				data.viewMode = {
					reading: false,
					source: false,
					live: false,
				};
				delete data.disable;
				await this.saveSettings();
			}
		}*/
		this.addSettingTab(new RemarkRegexSettingTab(this.app, this));
		this.registerMarkdownPostProcessor((element: HTMLElement) => {
			MarkdownProcessor(this.settings.mark, element, this.app);
		});
		this.extensions = [];
		this.updateCmExtension();
		this.extensions.forEach((e) => this.registerEditorExtension(e));
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
		if (this.cmExtension) this.extensions.remove(this.cmExtension);
		this.cmExtension = cmExtension(this);
		this.extensions.push(...this.cmExtension);
		this.app.workspace.updateOptions();
	}
}
