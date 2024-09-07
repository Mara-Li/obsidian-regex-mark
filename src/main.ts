import type { Extension } from "@codemirror/state";
import { Plugin } from "obsidian";

import { cmExtension } from "./cmPlugin";
import { DEFAULT_SETTINGS, type SettingOptions } from "./interface";
import { MarkdownProcessor } from "./markdownProcessor";
import { RemarkRegexSettingTab } from "./settings";

export default class RegexMark extends Plugin {
	settings: SettingOptions;
	extensions: Extension[];
	cmExtension: Extension;

	async onload() {
		console.log("loading plugin RegexMark");
		await this.loadSettings();
		const hasDisable = this.settings.mark.filter((data) => data.disable);
		for (const data of hasDisable) {
			if (data.disable) {
				console.warn(`Deprecated disable option found for ${data.class}, removing it and ajust the viewMode option.`);
				data.viewMode = {
					reading: false,
					source: false,
					live: false,
				};
				delete data.disable;
				await this.saveSettings();
			}
		}
		this.addSettingTab(new RemarkRegexSettingTab(this.app, this));
		this.registerMarkdownPostProcessor((element: HTMLElement) => {
			MarkdownProcessor(this.settings.mark, element, this.app, this.settings.pattern);
		});
		this.cmExtension = cmExtension(this);
		this.extensions = [];
		this.updateCmExtension();
		this.registerEditorExtension(this.extensions);
	}

	onunload() {
		console.log("unloading plugin RegexMark");
	}

	async loadSettings() {
		const oldSettings = await this.loadData();
		if (Array.isArray(oldSettings)) {
			this.settings = {
				mark: oldSettings,
				pattern: DEFAULT_SETTINGS.pattern,
			};
			await this.saveSettings();
		} else {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async overrideSettings(settings: SettingOptions) {
		this.settings = settings;
		await this.saveSettings();
		this.updateCmExtension();
	}

	updateCmExtension() {
		this.extensions.remove(this.cmExtension);
		this.cmExtension = cmExtension(this);
		this.extensions.push(this.cmExtension);
		this.app.workspace.updateOptions();
	}
}
