import { type App, Notice, PluginSettingTab, Setting } from "obsidian";

import type RegexMark from "./main";
import { hasToHide, isValidRegex } from "./utils";


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
			text: "Regex Mark is a plugin that allows you to add custom CSS class to text that matches a regex.",
		});
		const link = productTitle.createEl("p", {
			text: "If you are not familiar with regex, you can use this tool to help you build regex: ",
			cls: "regex-setting-secondary",
		});
		link.createEl("a", {
			text: "https://regex101.com/",
			attr: {
				href: "https://regex101.com/",
				target: "_blank",
			},
		});
		link.createEl("span", {
			text: " (don't forget to set ",
		});
		link.createEl("span", {
			text: "ECMAScript (Javascript)",
			cls: "regex-setting-bold",
		});
		link.createEl("span", {
			text: " as the FLAVOR in the settings).",
		});

		const t = productTitle.createEl("p", {
			text: "You can create custom markdown markup with using the"});
		t.createEl("code", {text: "{{open:regex}}"});
		t.createEl("span", {text: " and "});
		t.createEl("code", {text: "{{close:regex}}"});
		t.createEl("span", {text: ". The open and close regex will be hidden in Live-Preview. You need to use the \"hide\" toggle to make it work."});
		const o = productTitle.createEl("p", {
			text: "Note that \"overwriting\" markdown (ie underline with underscore as "
		});
		o.createEl("code", {text: "__underline__"});
		o.createEl("span", {text: ") will not work in Reading Mode."});

		for (const data of this.plugin.settings) {
			new Setting(containerEl)
				.setClass("regex-setting")
				.addText((text) => {
					text
						.setValue(data.regex)
						.onChange(async (value) => {
							data.regex = value;
							await this.plugin.saveSettings();
							text.inputEl.setAttribute("regex-value", data.regex);
							//disable hide toggle if no group is found
							this.disableToggle(data);
						});
					text.inputEl.addClasses(["extra-width", "regex-input"]);
					this.addTooltip("regex", text.inputEl);
				})
				.addText((text) => {
					text
						.setValue(data.class)
						.onChange(async (value) => {
							data.class = value;
							await this.plugin.saveSettings();
							text.inputEl.setAttribute("css-value", data.class);
						});
					text.inputEl.addClasses(["extra-width", "css-input"]);
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
					toggle.toggleEl.addClass("group-toggle");
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
			this.disableToggle(data);

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
			})
			.addButton((button) => {
				button
					.setButtonText("Verify & apply")
					.setTooltip("Verify and apply the regexes")
					.onClick(async () => {
						const isDuplicate = this.findDuplicate();
						if (!isDuplicate) {
							new Notice("Duplicate regexes found, please fix them before applying.");
							return;
						}
						const valid = this.plugin.settings.every((d) => this.verifyRegex(d));
						const validCss = this.plugin.settings.every((d) => this.verifyClass(d));
						if (valid && validCss) {
							this.plugin.updateCmExtension();
							new Notice("Regexes are valid and applied.");
							return;
						}
						let msg = "Found: ";
						if (!valid) msg += "invalid regexes";
						if (!valid && !validCss) msg += " and ";
						if (!validCss) msg += "empty css";
						msg += ". Please fix them before applying.";
						new Notice(msg);
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

	verifyRegex(data: SettingOption) {
		const index = this.plugin.settings.indexOf(data);
		const regex = data.regex;
		const cb = document.querySelectorAll(".regex-input")[index];
		if (regex.trim().length === 0) {
			if (cb) cb.addClass("is-invalid");
			return false;
		}
		if (data.hide && (data.regex.includes("\\}") && data.regex.includes("}}"))) {
			new Notice("You can't use \\} in {{close:regex}} or {{open:regex}} if you want to hide the regex.");
			if (cb) cb.addClass("is-invalid");
			return false;
		}
		try {
			new RegExp(regex);
			if (cb) cb.removeClass("is-invalid");
			return true;
		} catch (_e) {
			console.warn("Invalid regex", regex);
			if (cb) cb.addClass("is-invalid");
			return false;
		}
	}

	verifyClass(data: SettingOption) {
		const css = data.class;
		const cb = document.querySelectorAll(".css-input")[this.plugin.settings.indexOf(data)];
		if (css.trim().length === 0) {
			if (cb) cb.addClass("is-invalid");
			return false;
		}
		cb?.removeClass("is-invalid");
		return true;
	}

	disableToggle(data: SettingOption) {
		const index = this.plugin.settings.indexOf(data);
		const toggle = document.querySelectorAll(".group-toggle")[index];
		const verify = !hasToHide(data.regex) || !isValidRegex(data.regex, false) || data.regex.trim().length === 0;

		if (toggle) {
			toggle.toggleClass("is-disabled-manually", verify);
		}
	}

	findDuplicate() {
		//find the index of the first duplicate in this.plugin.settings
		const duplicateIndex: {
			regex: string;
			index: number[];
		}[] = [];
		//remove all is-invalid class
		document.querySelectorAll(".is-invalid").forEach((d) => d.removeClass("is-invalid"));
		for (const data of this.plugin.settings) {
			const index = duplicateIndex.findIndex((d) => d.regex === data.regex);
			if (index >= 0) {
				duplicateIndex[index].index.push(this.plugin.settings.indexOf(data));
			} else {
				duplicateIndex.push({
					regex: data.regex,
					index: [this.plugin.settings.indexOf(data)],
				});
			}
		}

		const allDuplicateIndex = duplicateIndex.flatMap((d) => d.index.length > 1 ? d.index : []);
		if (allDuplicateIndex.length === 0) return true;
		for (const duplicate of allDuplicateIndex) {
			const cb = document.querySelectorAll(".regex-input")[duplicate];
			if (cb) cb.addClass("is-invalid");
			const regex = this.plugin.settings[duplicate].regex;
			new Notice(`Duplicate regex: ${regex}.`);
		}
		return false;
	}
}




