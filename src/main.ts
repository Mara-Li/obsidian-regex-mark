import type { Extension } from "@codemirror/state";
import { Plugin } from "obsidian";

import { cmExtension } from "./cmPlugin";
import { MarkdownProcesser } from "./markdownProcesser";
import { RemarkRegexSettingTab } from "./settings";
import type { SettingOptions } from "./interface";

export default class RegexMark extends Plugin {
	settings: SettingOptions = [];
	extensions: Extension[];
	cmExtension: Extension;

	async onload() {
		console.log("loading plugin RegexMark");
		await this.loadSettings();
		const hasDisable = this.settings.filter((data) => data.disable);
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
			MarkdownProcesser(this.settings, element, this.app);
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
		this.settings = Object.assign([], [], await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateCmExtension() {
		this.extensions.remove(this.cmExtension);
		this.cmExtension = cmExtension(this);
		this.extensions.push(this.cmExtension);
		this.app.workspace.updateOptions();
	}
}
