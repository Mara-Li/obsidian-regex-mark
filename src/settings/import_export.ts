import { Notice, Setting, SettingPage, type TextAreaComponent } from "obsidian";
import type { MarkRuleObj, SettingOptionsObj, SettingOptionsObj0 } from "../interface";
import type { SettingOptions } from "../model";

export class ImportPage extends SettingPage {
	constructor(
		private settings: SettingOptions,
		private onImported: () => void
	) {
		super();
		this.title = "Import settings";
		this.containerEl.addClass("RegexMark");
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const errorEl = containerEl.createDiv({ cls: "import-error" });
		const showError = (message: string) => {
			errorEl.setText(message);
			errorEl.addClass("active");
		};

		const importAndNotify = (str: string) => {
			errorEl.removeClass("active");
			if (!str) {
				showError("No importation detected");
				return;
			}
			try {
				const importSettings = JSON.parse(str) as SettingOptionsObj | SettingOptionsObj0 | MarkRuleObj;
				this.settings.merge(importSettings);
			} catch (e) {
				console.error(e);
				const error = e as Error;
				showError(`Error during importation: ${error.message} Individual Errors: ${String(error.cause)}`);
				return;
			}
			new Notice("Regexes imported");
			this.onImported();
		};

		const fileInput = containerEl.createEl("input", {
			attr: { type: "file", accept: ".json" },
		});
		fileInput.hide();
		fileInput.addEventListener("change", () => {
			const file = fileInput.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = (e) => {
				const result = e.target?.result;
				importAndNotify(typeof result === "string" ? result.trim() : "");
			};
			reader.readAsText(file);
		});

		new Setting(containerEl)
			.setName("Import from a file")
			.setDesc("Allow to import regex from other users.")
			.addButton((button) => button.setButtonText("Choose a file").onClick(() => fileInput.click()));

		let textArea: TextAreaComponent;
		new Setting(containerEl)
			.setName("Import from text")
			.setDesc("Paste the exported settings.")
			.setClass("regex-textarea")
			.addTextArea((text) => {
				textArea = text;
				text.setPlaceholder("Paste your settings here");
				text.inputEl.addClass("import-textarea");
			});

		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText("Import")
				.setCta()
				.onClick(() => importAndNotify(textArea.getValue().trim()))
		);
	}
}

export class ExportPage extends SettingPage {
	constructor(private settings: SettingOptions) {
		super();
		this.title = "Export settings";
		this.containerEl.addClass("RegexMark");
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const output = JSON.stringify(this.settings.serialize(), null, 2);

		new Setting(containerEl)
			.setName("Copy to clipboard")
			.setDesc("Allow to export regex to share it with other users.")
			.addButton((button) =>
				button.setButtonText("Copy").onClick(async () => {
					await navigator.clipboard.writeText(output);
					new Notice("Copied to clipboard");
				})
			);

		new Setting(containerEl).setName("Download as a file").addButton((button) =>
			button.setButtonText("Download").onClick(() => {
				const blob = new Blob([output], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				// biome-ignore lint/correctness/noUndeclaredVariables: createEl is a global added by Obsidian
				const a = createEl("a", { attr: { href: url, download: "regexmark.json" } });
				a.click();
				URL.revokeObjectURL(url);
			})
		);

		new Setting(containerEl)
			.setName("Content")
			.setClass("regex-textarea")
			.addTextArea((text) => {
				text.setValue(output);
				text.inputEl.readOnly = true;
				text.inputEl.addClass("export-textarea");
			});
	}
}
