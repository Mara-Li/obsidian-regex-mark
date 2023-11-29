import { App, PluginSettingTab, Setting } from "obsidian";

import RegexMark from "./main";


export interface SettingOption {
  regex: string
  class: string
  hide?: boolean
}

export type SettingOptions = SettingOption[]

export class RemarkRegexSettingTab extends PluginSettingTab {
	plugin: RegexMark;

	constructor(app: App, plugin: RegexMark) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const productTitle = containerEl.createDiv();
		productTitle.createEl("p", {
			text: "Regex Mark",
			cls: "h2",
		});
		productTitle.createEl("p", {
			text: "Regex Mark is a plugin that allows you to add custom CSS class to text that matches a regex.",
		});
		const link = productTitle.createEl("p", {
			text: "If you are not familiar with regex, you can use this tool to help you build regex: ",
			cls: "secondary",
		});
		link.createEl("a", {
			text: "https://regex101.com/",
			attr: {
				href: "https://regex101.com/",
				target: "_blank",
			},
		});
		productTitle.createEl("p", {
			text: "This plugin requires reopen the file to take effect.",
			cls: "secondary",
		});

		const infoSub = productTitle.createEl("p");
		infoSub.innerHTML = "You can create custom markdown markup with using the <code>{{open:regex}}</code> and <code>{{close:regex}}</code>. The open and close regex will be hidden in Live-Preview. You need to use the \"hide\" toggle to make it work.<br><br>Note that \"overwriting\" markdown (ie underline with underscore) will not work in Reading Mode.";

		for (const data of this.plugin.settings) {
			new Setting(containerEl)
				.setClass("regex-setting")
				.addText((text) => {
					text
						.setValue(data.regex)
						.onChange(async (value) => {
							data.regex = value;
							await this.plugin.saveSettings();
						});
					text.inputEl.addClass("extra-width");
					this.addTooltip("regex", text.inputEl);
				})
				.addText((text) => {
					text
						.setValue(data.class)
						.onChange(async (value) => {
							data.class = value;
							await this.plugin.saveSettings();
						});
					text.inputEl.addClass("extra-width");
					this.addTooltip("class", text.inputEl);
				})
				.addToggle((toggle) => {
					toggle
						.setValue(data.hide ?? false)
						.setTooltip("Hide the regex in Live-Preview, only keeping the content.")
						.onChange(async (value) => {
							data.hide = value;
							await this.plugin.saveSettings();
						});
				})
				.addExtraButton((button) => {
					button
						.setIcon("trash")
						.setTooltip("Delete this regex")
						.onClick(async () => {
							this.plugin.settings = this.plugin.settings.filter((d) => d !== data);
							await this.plugin.saveSettings();
							this.display();
						});
				})
				.addExtraButton((button) => {
					button
						.setIcon("arrow-up")
						.setTooltip("Move this regex up")
						.onClick(async () => {
							const index = this.plugin.settings.indexOf(data);
							if (index > 0) {
								this.plugin.settings.splice(index - 1, 0, this.plugin.settings.splice(index, 1)[0]);
								await this.plugin.saveSettings();
								this.display();
							}
						});
				})
				.addExtraButton((button) => {
					button
						.setIcon("arrow-down")
						.setTooltip("Move this regex down")
						.onClick(async () => {
							const index = this.plugin.settings.indexOf(data);
							if (index < this.plugin.settings.length - 1) {
								this.plugin.settings.splice(index + 1, 0, this.plugin.settings.splice(index, 1)[0]);
								await this.plugin.saveSettings();
								this.display();
							}
						});
				});
		}

		//add + button
		new Setting(containerEl)
			.addButton((button) => {
				button
					.setButtonText("Add Regex")
					.setTooltip("Add a new regex")
					.onClick(async () => {
						this.plugin.settings.push({
							regex: "",
							class: "",
							hide: false,
						});
						await this.plugin.saveSettings();
						this.display();
					});
			});
	}

	addTooltip(text: string, cb: HTMLElement) {
		cb.onfocus = () => {
			const tooltip = cb.parentElement?.createEl("div", { text, cls: "tooltip" });
			if (tooltip) {
				const rec = cb.getBoundingClientRect();
				tooltip.style.top = `${rec.top + rec.height + 5}px`;
				tooltip.style.left = `${rec.left + rec.width / 2}px`;
			}
		};
		cb.onblur = () => {
			cb.parentElement?.querySelector(".tooltip")?.remove();
		};
	}
}

