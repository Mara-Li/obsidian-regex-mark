import { ButtonComponent, Modal, Notice, Platform, Setting, TextAreaComponent } from "obsidian";
import type { MarkRuleObj, SettingOptionsObj, SettingOptionsObj0 } from "../interface";
import type RegexMark from "../main";
import type { SettingOptions } from "../model";
import type { RemarkRegexSettingTab } from ".";

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
				if (str) {
					try {
						const importSettings = JSON.parse(str) as SettingOptionsObj | SettingOptionsObj0 | MarkRuleObj;
						this.settings.merge(importSettings);
						this.close();
					} catch (e) {
						console.error(e);
						errorSpan.addClass("active");
						errorSpan.setText(`Error during importation: ${e.message} Individual Errors: ${e.cause}`);
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
		this.settingTab.display();
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
				const output = JSON.stringify(this.settings.serialize(), null, 2);
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
								navigator.clipboard.writeText(textArea.inputEl.value).then(() => {
									new Notice("Copied to clipboard");
								});
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
