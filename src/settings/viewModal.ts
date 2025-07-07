import { type App, Modal, Setting, sanitizeHTMLToDom } from "obsidian";
import { DEFAULT_VIEW_MODE, type ViewMode } from "../interface";

export class RemarkRegexOptions extends Modal {
	result: ViewMode;
	regexMark: ViewMode | undefined;
	onSubmit: (result: ViewMode) => void;

	constructor(
		app: App,
		regexMark: ViewMode | undefined,
		private propertyName: string,
		onSubmit: (result: ViewMode) => void
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.regexMark = regexMark;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("remark-regex-options");
		this.result = this.regexMark || DEFAULT_VIEW_MODE;

		new Setting(contentEl)
			.setName("View mode")
			.setHeading()
			.setDesc("Allow to choose where the regex should be applied. Each toggle are independent.");

		new Setting(contentEl)
			.setName("Reading mode")
			.setClass("p-4")
			.setDesc("Apply the regex to the reading mode")
			.addToggle((toggle) => {
				toggle.setValue(this.result.reading).onChange((value) => {
					this.result.reading = value;
				});
			});

		new Setting(contentEl)
			.setName("Source mode")
			.setClass("p-4")
			.setDesc("Note: In source mode, open and close tags are not hidden. It will just enable the css class.")
			.addToggle((toggle) => {
				toggle.setValue(this.result.source).onChange((value) => {
					this.result.source = value;
				});
			});

		new Setting(contentEl)
			.setName("Live mode")
			.setClass("p-4")
			.setDesc("Apply the regex to the live mode")
			.addToggle((toggle) => {
				toggle.setValue(this.result.live).onChange((value) => {
					this.result.live = value;
				});
			});

		this.contentEl.createEl("hr");

		new Setting(contentEl)
			.setHeading()
			.setName("Code")
			.setDesc("Apply the regex when the text is within code (inline or block).")
			.addToggle((toggle) => {
				toggle.setValue(this.result.codeBlock ?? true).onChange((value) => {
					this.result.codeBlock = value;
				});
			});

		new Setting(contentEl)
			.setHeading()
			.setName("Auto rules")
			.setDesc(
				sanitizeHTMLToDom(
					`Define rules to automatically include or exclude the regex based on file path or the frontmatter value of <code>${this.propertyName}</code>.`
				)
			)
			.addExtraButton((cb) => {
				cb.setIcon("plus")
					.setTooltip("Add auto rule")
					.onClick(() => {
						this.result.autoRules = this.result.autoRules || [];
						this.result.autoRules.push({ type: "path", value: "", exclude: false });
						this.contentEl.empty();
						this.onOpen();
					});
			});

		for (const rule of this.result.autoRules || []) {
			new Setting(contentEl)
				.addDropdown((dp) => {
					dp.addOption("not", "Not")
						.addOption("equal", "Equal")
						.setValue(!rule.exclude ? "equal" : "not")
						.onChange((value) => {
							rule.exclude = value === "not";
						});
				})
				.setClass("full-width")
				.setClass("no-info")
				.addDropdown((dropdown) => {
					dropdown
						.addOption("path", "Path")
						.addOption("frontmatter", "Properties")
						.setValue(rule.type)
						.onChange(async (value) => {
							rule.type = value as "path" | "frontmatter";
						});
				})
				.addText((text) => {
					text
						.setValue(rule.value)
						.setPlaceholder("Enter a regex or a string")
						.onChange(async (value) => {
							rule.value = value;
						});
				})
				.addExtraButton((button) => {
					button.setIcon("trash").onClick(async () => {
						const index = this.result.autoRules?.findIndex((r) => r === rule);
						if (index === undefined) return;
						this.result.autoRules?.splice(index, 1);
						this.contentEl.empty();
						this.onOpen();
					});
				})
				.addExtraButton((button) => {
					button.setIcon("chevron-up").onClick(async () => {
						const index = this.result.autoRules?.findIndex((r) => r === rule);
						if (index === undefined || index <= 0) return;
						this.result.autoRules?.splice(index, 1);
						this.result.autoRules?.splice(index - 1, 0, rule);
						this.contentEl.empty();
						this.onOpen();
					});
				})
				.addExtraButton((button) => {
					button.setIcon("chevron-down").onClick(async () => {
						const index = this.result.autoRules?.findIndex((r) => r === rule);
						if (index === undefined || (this.result.autoRules && index >= this.result.autoRules.length - 1)) return;
						this.result.autoRules?.splice(index, 1);
						this.result.autoRules?.splice(index + 1, 0, rule);
						this.contentEl.empty();
						this.onOpen();
					});
				});
		}

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
