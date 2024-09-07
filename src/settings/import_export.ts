import { cloneDeep } from "lodash";
import { ButtonComponent, Modal, Platform, Setting, TextAreaComponent } from "obsidian";
import type { RemarkRegexSettingTab } from ".";
import type { Mark, SettingOption, SettingOptions } from "../interface";
import type RegexMark from "../main";

export class ImportSettings extends Modal {
	plugin: RegexMark;
	settings: SettingOptions;
	settingTab: RemarkRegexSettingTab;

	constructor(plugin: RegexMark, settings: SettingOptions, tab: RemarkRegexSettingTab) {
		super(plugin.app);
		this.plugin = plugin;
		this.settings = settings;
		this.settingTab = tab;
	}

	onOpen() {
		const { contentEl } = this;
		this.contentEl.addClass("RegexMark");

		new Setting(contentEl).setName("Import settings").setDesc("Allow to import regex from other users.").setHeading();

		new Setting(contentEl).then((setting) => {
			// biome-ignore lint/correctness/noUndeclaredVariables: createSpan is a function builded with the plugin
			const errorSpan = createSpan({
				cls: "import-error",
				text: "Error during the importation: ",
			});
			setting.nameEl.appendChild(errorSpan);
			const importAndClose = async (str: string) => {
				const oldSettings = cloneDeep(this.settings);
				if (str) {
					try {
						const importSettings = JSON.parse(str) as unknown;
						if (importSettings) {
							if (Object.hasOwn(importSettings, "pattern")) {
								oldSettings.pattern = (importSettings as SettingOptions).pattern;
								delete (importSettings as SettingOptions).pattern;
							}
							const marks: Mark = [];
							//import the list of regex only
							if (Object.hasOwn(importSettings, "mark") || importSettings instanceof Array) {
								if (Object.hasOwn(importSettings, "mark")) {
									marks.push(...(importSettings as SettingOptions).mark);
								} else if (importSettings instanceof Array) {
									marks.push(...(importSettings as Mark));
								}
								for (const setting of marks) {
									if (!setting.regex || !setting.class) {
										throw new Error("Invalid importation");
									}
								}
								//import only if not in the old settings
								const imported = marks.filter((setting: SettingOption) => {
									return !oldSettings.mark.find((oldSetting: SettingOption) => oldSetting.regex === setting.regex);
								});
								oldSettings.mark.push(...imported);
								this.settings = oldSettings;
							} else if (importSettings instanceof Object && !Object.hasOwn(importSettings, "mark")) {
								if (!Object.hasOwn(importSettings, "regex") || !Object.hasOwn(importSettings, "class")) {
									throw new Error("Invalid importation");
								}
								const imported = importSettings as SettingOption;
								if (!oldSettings.mark.find((oldSetting: SettingOption) => oldSetting.regex === imported.regex)) {
									oldSettings.mark.push(importSettings as SettingOption);
									this.settings = oldSettings;
								} else {
									throw new Error("Already in the settings");
								}
							}
						}
						await this.plugin.overrideSettings(oldSettings);
						this.close();
						this.settingTab.display();
					} catch (e) {
						errorSpan.addClass("active");
						errorSpan.setText(`Error during importation: ${e}`);
					}
				} else {
					errorSpan.addClass("active");
					errorSpan.setText("No importation detected");
				}
			};
			setting.controlEl.createEl(
				"input",
				{
					cls: "import-input",
					attr: {
						id: "import-input",
						name: "import-input",
						type: "file",
						accept: ".json",
					},
				},
				(importInput) => {
					importInput.addEventListener("change", async (e) => {
						const reader = new FileReader();
						reader.onload = async (e: ProgressEvent<FileReader>) => {
							await importAndClose(e!.target!.result?.toString().trim() ?? "");
						};
						reader.readAsText((e.target as HTMLInputElement).files![0]);
					});
				}
			);
			setting.controlEl.createEl("label", {
				cls: "import-label",
				text: "Import from a file",
				attr: {
					for: "import-input",
				},
			});

			const textArea = new TextAreaComponent(contentEl).setPlaceholder("Paste your settings here").then((textArea) => {
				const saveButton = new ButtonComponent(contentEl).setButtonText("Save").onClick(async () => {
					await importAndClose(textArea.getValue());
				});
				saveButton.buttonEl.addClass("import-save");
			});
			textArea.inputEl.addClass("import-textarea");
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class ExportSettings extends Modal {
	plugin: RegexMark;
	settings: SettingOptions;
	settingTab: RemarkRegexSettingTab;

	constructor(plugin: RegexMark, settings: SettingOptions, tab: RemarkRegexSettingTab) {
		super(plugin.app);
		this.plugin = plugin;
		this.settings = settings;
		this.settingTab = tab;
	}

	onOpen() {
		const { contentEl } = this;
		this.contentEl.addClass("RegexMark");

		new Setting(contentEl)
			.setName("Export settings")
			.setDesc("Allow to export regex to share it with other users.")
			.then((setting) => {
				const copied = cloneDeep(this.settings);
				const output = JSON.stringify(copied, null, 2);
				setting.controlEl.createEl(
					"a",
					{
						cls: "copy",
						text: "Copy to clipboard",
						href: "#",
					},
					(copyButton) => {
						const textArea = new TextAreaComponent(contentEl).setValue(output).then((textArea) => {
							copyButton.addEventListener("click", (e) => {
								e.preventDefault();
								textArea.inputEl.select();
								textArea.inputEl.setSelectionRange(0, 99999);
								//use clipboard API
								navigator.clipboard.writeText(textArea.inputEl.value);
								copyButton.addClass("success");
								setTimeout(() => {
									if (copyButton.parentNode) copyButton.removeClass("success");
								}, 2000);
							});
						});
						textArea.inputEl.addClass("export-textarea");
					}
				);
				if (Platform.isDesktop) {
					setting.controlEl.createEl("a", {
						cls: "download",
						text: "Download",
						attr: {
							download: "regexmark.json",
							href: `data:text/json;charset=utf-8,${encodeURIComponent(output)}`,
						},
					});
				} else if (Platform.isMobile) {
					setting.addButton((button) => {
						button
							.setClass("download")
							.setButtonText("Download")
							.onClick(() => {
								const blob = new Blob([output], { type: "application/json" });
								const url = URL.createObjectURL(blob);
								const a = document.createElement("a");
								a.href = url;
								a.download = "regexmark.json";
								a.click();
								URL.revokeObjectURL(url);
							});
					});
				}
			});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
