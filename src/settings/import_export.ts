import { ButtonComponent, Modal, Setting, TextAreaComponent } from "obsidian";
import type RegexMark from "../main";
import type { SettingOption, SettingOptions } from "../interface";

export class Import extends Modal {
	plugin: RegexMark;
	settings: SettingOptions;

	constructor(plugin: RegexMark, settings: SettingOptions) {
		super(plugin.app);
		this.plugin = plugin;
		this.settings = settings;
	}

	onOpen() {
		const { contentEl } = this;

		new Setting(contentEl).setName("Import settings").setDesc("Allow to import and export regex from other users.");

		new Setting(contentEl).then((setting) => {
			// biome-ignore lint/correctness/noUndeclaredVariables: createSpan is a function builded with the plugin
			const errorSpan = createSpan({
				cls: "regexMark-import-error",
				text: "Error during the importation: ",
			});
			setting.nameEl.appendChild(errorSpan);
			const importAndClose = async (str: string) => {
				if (str) {
					try {
						const importSettings = JSON.parse(str) as unknown;
						if (importSettings) {
							if (importSettings instanceof Array) {
								//append at the end of the array
								this.settings.push(...importSettings);
							} else if (importSettings instanceof Object) {
								this.settings.push(importSettings as SettingOption);
							} else {
								throw new Error("Invalid importation");
							}
							await this.plugin.saveSettings();
						}
						this.close();
					} catch (e) {
						errorSpan.addClass("active");
						errorSpan.setText(`Erreur lors de l'importation: ${e}`);
					}
				} else {
					errorSpan.addClass("active");
					errorSpan.setText("No importation detected");
				}
			};
			setting.controlEl.createEl(
				"input",
				{
					cls: "regexMark-import-input",
					attr: {
						id: "regexMark-import-input",
						name: "regexMark-import-input",
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
				cls: "regexMark-import-label",
				text: "Import depuis un fichier",
				attr: {
					for: "regexMark-import-input",
				},
			});

			const textArea = new TextAreaComponent(contentEl).setPlaceholder("Paste your settings here").then((textArea) => {
				const saveButton = new ButtonComponent(contentEl).setButtonText("Save").onClick(async () => {
					await importAndClose(textArea.getValue());
				});
				saveButton.buttonEl.addClass("regexMark-import-save");
			});
			textArea.inputEl.addClass("regexMark-import-textarea");
		});
	}
}
