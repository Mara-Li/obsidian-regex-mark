import { type App, Modal, Setting } from "obsidian";
import { DEFAULT_VIEW_MODE, type ViewMode } from "../interface";

export class RemarkRegexOptions extends Modal {
	result: ViewMode;
	regexMark: ViewMode | undefined;
	onSubmit: (result: ViewMode) => void;

	constructor(app: App, regexMark: ViewMode | undefined, onSubmit: (result: ViewMode) => void) {
		super(app);
		this.onSubmit = onSubmit;
		this.regexMark = regexMark;
	}

	onOpen(): void {
		const { contentEl } = this;
		this.result = this.regexMark || DEFAULT_VIEW_MODE;

		new Setting(contentEl)
			.setName("View mode")
			.setDesc("Allow to choose where the regex should be applied. Each toggle are independent.");

		new Setting(contentEl)
			.setName("Reading mode")
			.setDesc("Apply the regex to the reading mode")
			.addToggle((toggle) => {
				toggle.setValue(this.result.reading).onChange((value) => {
					this.result.reading = value;
				});
			});

		new Setting(contentEl)
			.setName("Source mode")
			.setDesc("Note: In source mode, open and close tags are not hidden. It will just enable the css class.")
			.addToggle((toggle) => {
				toggle.setValue(this.result.source).onChange((value) => {
					this.result.source = value;
				});
			});

		new Setting(contentEl)
			.setName("Live mode")
			.setDesc("Apply the regex to the live mode")
			.addToggle((toggle) => {
				toggle.setValue(this.result.live).onChange((value) => {
					this.result.live = value;
				});
			});

		new Setting(contentEl)
			.addButton((button) => {
				button
					.setButtonText("Save")
					.setCta()
					.onClick(() => {
						this.onSubmit(this.result);
						this.close();
					});
			})
			.addButton((button) => {
				button
					.setButtonText("Cancel")
					.setWarning()
					.onClick(() => {
						this.close();
					});
			});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
