import { cloneDeep } from "lodash";
import { type App, Notice, PluginSettingTab, Setting, type ToggleComponent, sanitizeHTMLToDom } from "obsidian";
import { dedent } from "ts-dedent";
import {
	DEFAULT_PATTERN,
	DEFAULT_VIEW_MODE,
	type Pattern,
	type RegexFlags,
	type SettingOption,
	type SettingOptions,
	type ViewMode,
} from "../interface";
import type RegexMark from "../main";
import { hasToHide, isInvalid, isValidRegex, removeTags } from "../utils";
import { RemarkPatternTab } from "./change_pattern";
import { ExportSettings, ImportSettings } from "./import_export";
import { RemarkRegexOptions } from "./viewModal";

export class RemarkRegexSettingTab extends PluginSettingTab {
	plugin: RegexMark;
	settings: SettingOptions;

	constructor(app: App, plugin: RegexMark) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = plugin.settings;
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

	cloneViewMode(mode: SettingOption): ViewMode {
		return cloneDeep(mode.viewMode ?? DEFAULT_VIEW_MODE);
	}

	clonePattern(pattern: SettingOptions): Pattern {
		return cloneDeep(pattern.pattern ?? { open: "{{open:}}", close: "{{close:}}" });
	}

	updateRegex(newPattern: Pattern) {
		const oldPattern = this.settings.pattern ?? DEFAULT_PATTERN;
		const notValid = [];
		for (const data of this.settings.mark) {
			const newAsString: Pattern = {
				open: newPattern.open.replace("(.*?)", "$1").replaceAll(/\\/g, ""),
				close: newPattern.close.replace("(.*?)", "$1").replaceAll(/\\/g, ""),
			};
			const reg = data.regex
				.replace(new RegExp(oldPattern.open), newAsString.open)
				.replace(new RegExp(oldPattern.close), newAsString.close);
			const newData = Object.assign(data, { regex: reg });
			const valid = this.verifyRegex(newData, newPattern);
			if (!valid) {
				newData.viewMode = {
					reading: false,
					source: false,
					live: false,
				};
				notValid.push(newData.regex);
			}
		}
		const html = notValid.map((d) => `<li class="error"><code>${d}</code></li>`).join("");
		if (notValid.length > 0)
			new Notice(
				sanitizeHTMLToDom(`<span class="RegexMark error">The following regexes are invalid: <ul>${html}</ul></span>`),
				0
			);
	}

	stringifyPattern(pattern: Pattern) {
		return {
			open: pattern.open.replace("(.*?)", "regex").replaceAll(/\\/g, ""),
			close: pattern.close.replace("(.*?)", "regex").replaceAll(/\\/g, ""),
		};
	}

	display(): void {
		const { containerEl } = this;
		containerEl.addClass("RegexMark");
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
			})
			.addButton((button) => {
				button
					.setButtonText("Change open/close tags")
					.setTooltip("Advanced user only! Allow to change the tags for hiding element")
					.onClick(async () => {
						new RemarkPatternTab(this.app, this.clonePattern(this.settings), async (result) => {
							this.updateRegex(result);
							this.plugin.settings.pattern = result;
							await this.plugin.saveSettings();
							this.display();
						}).open();
					});
			});
		const productTitle = containerEl.createEl("p", {
			text: "Regex Mark allows to add custom CSS class to text that matches a regex.",
		});
		const pattern = this.stringifyPattern(this.plugin.settings.pattern ?? DEFAULT_PATTERN);

		const els = dedent(`
			<p class="regex-setting-secondary">If you are not familiar with regex, you can use this tool to help you build regex:
				<a href="https://regex101.com/" target="_blank">https://regex101.com/</a> (don't forget to set <strong>ECMAScript (Javascript)</strong> as the FLAVOR in the settings).
			</p>
			
			<p>You can create custom MarkDown Markup with using the <code>${pattern.open}</code> and <code>${pattern.close}</code>. The open and close regex will be hidden in Live-Preview. You need to use the "hide" toggle to make it work.<br><br>
			To activate the toggle, you need to use a <b>regex group</b>. See <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Groups_and_backreferences">here for more information</a>.<br>
			<div data-callout-metadata="" data-callout-fold="" data-callout="important" class="callout"><div class="callout-title" dir="auto"><div class="callout-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-flame"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg></div><div class="callout-title-inner">Named group</div></div><div class="callout-content">
			<p dir="auto">Named group allow to "granular" match regex. Name will be used as CSS classes. Note that it is pretty experimental so don't expect much!<br>Also, you needs to use named group for <bold>each group</bold> in the regex.</p>
			</div></div>
			<div data-callout-metadata="" data-callout-fold="" data-callout="note" class="callout">
				<div class="callout-title" dir="auto">
					<div class="callout-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-pencil">
							<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
							<path d="m15 5 4 4"></path>
						</svg>
					</div>
					<div class="callout-title-inner">Note</div>
				</div>
				<div class="callout-content">
					<p dir="auto">
					<li>"Overwriting" markdown (for example underline with underscore as <strong>underline</strong>) will not work in Reading Mode. But, you can escape the pattern, with a backslash (<code>\\</code>) before the mark to disable it! Don't forget it in the regex, through.</li>
					<li>Using a group in the opening and closing pattern is not supported.</li>
					</p>
				</div>
			</div>
			`);

		const customDom = sanitizeHTMLToDom(els);
		productTitle.appendChild(customDom);

		//add pattern change

		for (const data of this.plugin.settings.mark) {
			new Setting(containerEl)
				.setClass("regex-setting")
				.addExtraButton((button) => {
					button
						.setIcon("eye")
						.setTooltip("Edit the view mode")
						.onClick(async () => {
							new RemarkRegexOptions(this.app, this.cloneViewMode(data), async (result) => {
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
						this.disableToggle(data, this.plugin.settings.pattern);
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
					const verify =
						!hasToHide(data.regex, this.plugin.settings.pattern) ||
						!isValidRegex(data.regex, false, this.plugin.settings.pattern);
					this.toggleToolTip(toggle, verify);
				})
				.addExtraButton((button) => {
					button
						.setIcon("trash")
						.setTooltip("Delete this regex")
						.onClick(async () => {
							this.plugin.settings.mark = this.plugin.settings.mark.filter((d) => d !== data);
							await this.plugin.saveSettings();
							this.display();
						});
				})

				.addExtraButton((button) => {
					button
						.setIcon("arrow-up")
						.setTooltip("Move this regex up")
						.onClick(async () => {
							const index = this.plugin.settings.mark.indexOf(data);
							if (index <= 0) {
								return;
							}
							this.plugin.settings.mark.splice(index - 1, 0, this.plugin.settings.mark.splice(index, 1)[0]);
							await this.plugin.saveSettings();
							this.display();
						});
				})
				.addExtraButton((button) => {
					button
						.setIcon("arrow-down")
						.setTooltip("Move this regex down")
						.onClick(async () => {
							const index = this.plugin.settings.mark.indexOf(data);
							if (index >= this.plugin.settings.mark.length - 1) {
								return;
							}
							this.plugin.settings.mark.splice(index + 1, 0, this.plugin.settings.mark.splice(index, 1)[0]);
							await this.plugin.saveSettings();
							this.display();
						});
				});
			this.disableToggle(data, this.plugin.settings.pattern);
		}

		//add + button
		new Setting(containerEl)
			.addButton((button) => {
				button
					.setButtonText("Add Regex")
					.setTooltip("Add a new regex")
					.onClick(async () => {
						this.plugin.settings.mark.push({
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
						const validRegex = this.plugin.settings.mark.every((d) =>
							this.verifyRegex(d, this.plugin.settings.pattern)
						);
						const validCss = this.plugin.settings.mark.every((d) => this.verifyClass(d));
						if (validRegex && validCss) {
							try {
								this.plugin.updateCmExtension();
							} catch (e) {
								console.error(e);
								return;
							}
							this.display();
							new Notice(
								sanitizeHTMLToDom(`<span class="RegexMark success">🎉 Regexes applied successfully</span>`),
								0
							);
							return;
						}
						let msg = "Found ";
						if (!validRegex) msg += "invalid regexes";
						if (!validRegex && !validCss) msg += " and ";
						if (!validCss) msg += "empty css ";
						msg += ". Please fix them before applying.";
						new Notice(sanitizeHTMLToDom(`<span class="RegexMark error">${msg}</span>`));
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

	verifyRegex(data: SettingOption, pattern?: Pattern) {
		const index = this.plugin.settings.mark.indexOf(data);
		const regex = data.regex;
		const cb = document.querySelectorAll(".regex-input")[index];
		if (regex.trim().length === 0) {
			if (cb) cb.addClass("is-invalid");
			return false;
		}
		if (!pattern) pattern = this.plugin.settings.pattern ?? DEFAULT_PATTERN;
		if (data.hide && !isValidRegex(removeTags(regex, pattern))) {
			new Notice(sanitizeHTMLToDom(`<span class="RegexMark error">The open/close pattern is not recognized</span>`));
			if (cb) cb.addClass("is-invalid");
			return false;
		}
		if (isInvalid(data.regex)) {
			new Notice(
				sanitizeHTMLToDom(`<span class="RegexMark error">You need to add a new line after the [^] regex</span>`)
			);
			if (cb) cb.addClass("is-invalid");
			return false;
		}
		if (data.hide && !hasToHide(data.regex, this.plugin.settings.pattern)) {
			new Notice(
				sanitizeHTMLToDom(`<span class="RegexMark error">You need to use a group in the regex to hide it</span>`)
			);
			data.hide = false;
			this.plugin.saveSettings();
			this.disableToggle(data, this.plugin.settings.pattern);
			if (cb) cb.addClass("is-invalid");
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
		const cb = document.querySelectorAll(".css-input")[this.plugin.settings.mark.indexOf(data)];
		if (css.trim().length === 0) {
			if (cb) cb.addClass("is-invalid");
			return false;
		}
		cb?.removeClass("is-invalid");
		return true;
	}

	disableToggle(data: SettingOption, pattern?: Pattern) {
		const index = this.plugin.settings.mark.indexOf(data);
		const toggle = document.querySelectorAll<HTMLElement>(".group-toggle")[index];
		const verify =
			(!hasToHide(data.regex, pattern) || !isValidRegex(data.regex, false, pattern)) || data.regex.trim().length === 0;
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
		for (const data of this.plugin.settings.mark) {
			const index = duplicateIndex.findIndex((d) => d.regex === data.regex);
			if (index >= 0) {
				duplicateIndex[index].index.push(this.plugin.settings.mark.indexOf(data));
			} else {
				duplicateIndex.push({
					regex: data.regex,
					index: [this.plugin.settings.mark.indexOf(data)],
				});
			}
		}

		const allDuplicateIndex = duplicateIndex.flatMap((d) => (d.index.length > 1 ? d.index : []));
		if (allDuplicateIndex.length === 0) return true;
		for (const duplicate of allDuplicateIndex) {
			const cb = document.querySelectorAll(".regex-input")[duplicate];
			if (cb) cb.addClass("is-invalid");
			const regex = this.plugin.settings.mark[duplicate].regex;
			new Notice(`Duplicate regex: ${regex}.`);
		}
		return false;
	}
}
