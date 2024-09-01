import { cloneDeep } from "lodash";
import { type App, Notice, PluginSettingTab, sanitizeHTMLToDom, Setting, type ToggleComponent } from "obsidian";
import { dedent } from "ts-dedent";
import { DEFAULT_VIEW_MODE, type RegexFlags, type SettingOption, type ViewMode } from "../interface";
import type RegexMark from "../main";
import { hasToHide, isInvalid, isValidRegex } from "../utils";
import { ExportSettings, ImportSettings } from "./import_export";
import { RemarkRegexOptions } from "./modal";

export class RemarkRegexSettingTab extends PluginSettingTab {
	plugin: RegexMark;

	constructor(app: App, plugin: RegexMark) {
		super(app, plugin);
		this.plugin = plugin;
	}

	toggleToolTip(toggle: ToggleComponent, verify: boolean) {
		if (verify) {
			toggle.setTooltip("Can't hide the regex if no group is found in it.");
			toggle.setDisabled(true);
		} else {
			toggle.setDisabled(false);
			toggle.setTooltip("Hide the regex in Live-Preview, only keeping the content.");
		}
	}

	clone(mode: SettingOption): ViewMode {
		return cloneDeep(mode.viewMode ?? DEFAULT_VIEW_MODE);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl)
			.setClass("import-export")
			.addButton((button) => {
				button.setButtonText("Import").onClick(() => {
					new ImportSettings(this.plugin, this.plugin.settings, this).open();
				});
			})
			.addButton((button) => {
				button.setButtonText("Export").onClick(() => {
					new ExportSettings(this.plugin, this.plugin.settings, this).open();
				});
			});
		const productTitle = containerEl.createEl("p", {
			text: "Regex Mark allows to add custom CSS class to text that matches a regex.",
		});

		const els = dedent(`
			<p class="regex-setting-secondary">If you are not familiar with regex, you can use this tool to help you build regex: 
			<a href="https://regex101.com/" target="_blank">https://regex101.com/</a> (don't forget to set <strong>ECMAScript (Javascript)</strong> as the FLAVOR in the settings).</p>

			<p> You can create custom MarkDown Markup with using the <code>{{open:regex}}</code> and <code>{{close:regex}}</code>. The open and close regex will be hidden in Live-Preview. You need to use the "hide" toggle to make it work.<br><br> To activate the toggle, you need to use a <b>regex group</b>. See <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Groups_and_backreferences">here for more information</a>.<br><span class="regex-setting-secondary"> Note: Named group is not implanted.</span></p>
			
			<p class="regex-mark-callout"> "Overwriting" markdown (for example underline with underscore as <code>__underline__</code>) will not work in Reading Mode.</p>
			`);

		const customDom = sanitizeHTMLToDom(els);
		productTitle.appendChild(customDom);

		for (const data of this.plugin.settings) {
			new Setting(containerEl)
				.setClass("regex-setting")
				.addExtraButton((button) => {
					button
						.setIcon("eye")
						.setTooltip("Edit the view mode")
						.onClick(async () => {
							new RemarkRegexOptions(this.app, this.clone(data), async (result) => {
								data.viewMode = result;
								await this.plugin.saveSettings();
								this.plugin.updateCmExtension();
							}).open();
						});
				})
				.addText((text) => {
					text.setValue(data.regex).onChange(async (value) => {
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
					text.setValue(data.flags?.join("").toLowerCase() ?? "gi").onChange(async (value) => {
						text.inputEl.removeClass("is-invalid");
						this.addTooltip("Regex flags", text.inputEl);
						data.flags = value
							.split("")
							.map((d) => d.toLowerCase())
							.filter(
								(d, index, self) => ["g", "i", "m", "s", "u", "y"].includes(d) && self.indexOf(d) === index
							) as RegexFlags[];
						const errors = value
							.split("")
							.filter((d, index, self) => !["g", "i", "m", "s", "u", "y"].includes(d) || self.indexOf(d) !== index);
						if (errors.length > 0) {
							text.inputEl.addClass("is-invalid");
							this.addTooltip(`Invalid flags ; they are automatically fixed at save`, text.inputEl);
						}
						await this.plugin.saveSettings();
					});
					text.inputEl.addClasses(["min-width", "flags-input"]);
					this.addTooltip("Regex flags", text.inputEl);
				})
				.addText((text) => {
					text.setValue(data.class).onChange(async (value) => {
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
					const verify = !hasToHide(data.regex) && !isValidRegex(data.regex, false);
					this.toggleToolTip(toggle, verify);
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
							if (index <= 0) {
								return;
							}
							this.plugin.settings.splice(index - 1, 0, this.plugin.settings.splice(index, 1)[0]);
							await this.plugin.saveSettings();
							this.display();
						});
				})
				.addExtraButton((button) => {
					button
						.setIcon("arrow-down")
						.setTooltip("Move this regex down")
						.onClick(async () => {
							const index = this.plugin.settings.indexOf(data);
							if (index >= this.plugin.settings.length - 1) {
								return;
							}
							this.plugin.settings.splice(index + 1, 0, this.plugin.settings.splice(index, 1)[0]);
							await this.plugin.saveSettings();
							this.display();
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
						const validRegex = this.plugin.settings.every((d) => this.verifyRegex(d));
						const validCss = this.plugin.settings.every((d) => this.verifyClass(d));
						if (validRegex && validCss) {
							this.plugin.updateCmExtension();
							new Notice("Regexes are valid and applied.");
							this.display();
							return;
						}
						let msg = "Found: ";
						if (!validRegex) msg += "invalid regexes";
						if (!validRegex && !validCss) msg += " and ";
						if (!validCss) msg += "empty css ";
						msg += ". Please fix them before applying.";
						new Notice(msg);
					});
			});
	}

	addTooltip(text: string, cb: HTMLElement) {
		cb.onfocus = () => {
			const tooltip = document.body.createEl("div", { text, cls: "tooltip" });
			if (!tooltip) return;
			tooltip.createEl("div", { cls: "tooltip-arrow" });
			const rec = cb.getBoundingClientRect();
			tooltip.style.top = `${rec.top + rec.height + 5}px`;
			tooltip.style.left = `${rec.left + rec.width / 2}px`;
			tooltip.style.right = `${rec.right}px`;
			tooltip.style.width = `max-content`;
			tooltip.style.height = `max-content`;
		};
		cb.onblur = () => {
			// biome-ignore lint/correctness/noUndeclaredVariables: <explanation>
			activeDocument.querySelector(".tooltip")?.remove();
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
		if (data.hide && data.regex.includes("\\}") && data.regex.includes("}}")) {
			new Notice("You can't use \\} in {{close:regex}} or {{open:regex}} if you want to hide the regex.");
			if (cb) cb.addClass("is-invalid");
			return false;
		}
		if (isInvalid(data.regex)) {
			new Notice("You need to add a new line after the [^] regex.");
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
		const toggle = document.querySelectorAll<HTMLElement>(".group-toggle")[index];
		const verify = (!hasToHide(data.regex) && !isValidRegex(data.regex, false)) || data.regex.trim().length === 0;
		if (toggle) toggle.toggleClass("is-disabled-manually", verify);
		if (!verify) {
			toggle.removeAttribute("disabled");
			toggle.removeAttribute("aria-hidden");
			return;
		}

		toggle.setAttribute("disabled", "true");
		toggle.ariaHidden = "true";
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

		const allDuplicateIndex = duplicateIndex.flatMap((d) => (d.index.length > 1 ? d.index : []));
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
