import { type App, Modal, Setting } from "obsidian";

export class PropertyModal extends Modal {
	result: string;

	constructor(
		app: App,
		private oldProperty: string,
		private onSubmit: (result: string) => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.result = this.oldProperty ?? "regex_mark";

		new Setting(contentEl)
			.setName("Property Name")
			.setDesc("The property name to search in the frontmatter")
			.addText((text) =>
				text.setValue(this.oldProperty ?? "regex_mark").onChange((value) => {
					this.result = value;
				})
			);

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
