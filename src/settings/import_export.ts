import { ButtonComponent, Modal, Platform, Setting, TextAreaComponent } from "obsidian";
import type RegexMark from "../main";
import type { SettingOption, SettingOptions } from "../interface";
import type { RemarkRegexSettingTab } from ".";
import { cloneDeep } from "lodash";

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
		this.contentEl.addClass("RegexMark")

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
							if (importSettings instanceof Array) {
								//Verify is all the settings are correct
								for (const setting of importSettings) {
									if (!setting.regex || !setting.class) {
										throw new Error("Invalid importation");
									}
								}
								//import only if not in the old settings
								const imported = importSettings.filter((setting: SettingOption) => {
									return !oldSettings.find((oldSetting: SettingOption) => oldSetting.regex === setting.regex);
								});
								oldSettings.push(...imported);
								this.settings = oldSettings;							
							} else if (importSettings instanceof Object) {
								if (!importSettings.hasOwnProperty("regex") || !importSettings.hasOwnProperty("class")) {
									throw new Error("Invalid importation");
								}
								const imported = importSettings as SettingOption;
								if (!oldSettings.find((oldSetting: SettingOption) => oldSetting.regex === imported.regex)) {
									oldSettings.push(importSettings as SettingOption);
									this.settings = oldSettings;
								} else {
									throw new Error("Already in the settings");
								}
							} else {
								throw new Error("Invalid importation");
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
		const { contentEl, modalEl } = this;
		this.contentEl.addClass("RegexMark")

		new Setting(contentEl)
			.setName("Export settings")
			.setDesc("Allow to export regex to share it with other users.")
			.then((setting) => {
				const copied = cloneDeep(this.settings);
				const output = JSON.stringify(copied, null, 2);
				setting.controlEl.createEl("a", {
					cls: "copy",
					text: "Copy to clipboard",
					href: "#",
				},
				(copyButton) => {
					const textArea = new TextAreaComponent(contentEl)
						.setValue(output)
						.then((textArea) => {
							copyButton.addEventListener("click", (e)=>{
								e.preventDefault();
								textArea.inputEl.select();
								textArea.inputEl.setSelectionRange(0, 99999);
								//use clipboard API
								navigator.clipboard.writeText(textArea.inputEl.value);
								copyButton.addClass("success");
								setTimeout(() => {
									if (copyButton.parentNode) copyButton.removeClass("success");
								}, 2000);
							})
						});
						textArea.inputEl.addClass("export-textarea");
				})
				if (Platform.isDesktop) {
					setting.controlEl.createEl("a", {
						cls: "download",
						text: "Download",
						attr: {
							download: "regexmark.json",
							href: `data:text/json;charset=utf-8,${encodeURIComponent(output)}`,
						}
					})
				} else if (Platform.isMobile) {
					setting.addButton((button) => {
						button.setClass("download").setButtonText("Download")
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