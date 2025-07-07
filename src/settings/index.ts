import { cloneDeep } from "lodash";
import {
	type App,
	MarkdownRenderer,
	Notice,
	PluginSettingTab,
	Setting,
	sanitizeHTMLToDom,
	type ToggleComponent,
} from "obsidian";
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
import { PropertyModal } from "./property_name";
import { RemarkRegexOptions } from "./viewModal";

export class RemarkRegexSettingTab extends PluginSettingTab {
	plugin: RegexMark;
	settings: SettingOptions;
	toggles: Map<SettingOption, ToggleComponent> = new Map();

	constructor(app: App, plugin: RegexMark) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = plugin.settings;
	}

	/**
	 * Disable the toggle option if the regex doesn't contain any group
	 * @param data - The setting option containing regex information
	 */
	disableToggle(data: SettingOption) {
		const isRegexInvalid = this.verifyRegexFromInput(data);
		const toggleComponent = this.toggles.get(data);

		if (toggleComponent) {
			toggleComponent.toggleEl.toggleClass("is-disabled-manually", isRegexInvalid);
			toggleComponent.setDisabled(isRegexInvalid);

			const tooltip = isRegexInvalid
				? "Can't hide the regex if no group is found in it."
				: "Hide the regex in Live-Preview, only keeping the content.";

			toggleComponent.setTooltip(tooltip);
		}
	}

	/**
	 * Create a deep copy of the view mode
	 */
	cloneViewMode(mode: SettingOption): ViewMode {
		return cloneDeep(mode.viewMode ?? DEFAULT_VIEW_MODE);
	}

	/**
	 * Create a deep copy of the pattern configuration
	 */
	clonePattern(pattern: SettingOptions): Pattern {
		return cloneDeep(pattern.pattern ?? { open: "{{open:}}", close: "{{close:}}" });
	}

	/**
	 * Updates all regex patterns when the open/close tags are changed
	 */
	updateRegex(newPattern: Pattern) {
		const oldPattern = this.settings.pattern ?? DEFAULT_PATTERN;
		const notValid = [];

		// Create a simplified pattern without escaping characters
		const simplifiedPattern: Pattern = {
			open: newPattern.open.replace("(.*?)", "$1").replaceAll(/\\/g, ""),
			close: newPattern.close.replace("(.*?)", "$1").replaceAll(/\\/g, ""),
		};

		// Update each regex with the new pattern
		for (const data of this.settings.mark) {
			const updatedRegex = data.regex
				.replace(new RegExp(oldPattern.open), simplifiedPattern.open)
				.replace(new RegExp(oldPattern.close), simplifiedPattern.close);

			// Apply changes to the data object
			Object.assign(data, { regex: updatedRegex });

			// Verify if the new regex is valid
			const isValid = this.verifyRegex(data, newPattern);
			if (!isValid) {
				data.viewMode = {
					reading: false,
					source: false,
					live: false,
				};
				notValid.push(data.regex);
			}
		}

		// Show notification for invalid regexes
		if (notValid.length > 0) {
			const htmlList = notValid.map((d) => `<li class="error"><code>${d}</code></li>`).join("");
			new Notice(
				sanitizeHTMLToDom(
					`<span class="RegexMark error">The following regexes are invalid: <ul>${htmlList}</ul></span>`
				),
				0
			);
		}
	}

	/**
	 * Creates a user-friendly representation of pattern
	 */
	stringifyPattern(pattern: Pattern) {
		return {
			open: pattern.open.replace("(.*?)", "regex").replaceAll(/\\/g, ""),
			close: pattern.close.replace("(.*?)", "regex").replaceAll(/\\/g, ""),
		};
	}

	/**
	 * Renders the settings interface
	 */
	async display(): Promise<void> {
		const { containerEl } = this;
		this.toggles.clear();
		containerEl.addClass("RegexMark");
		containerEl.empty();

		// Render header with import/export and pattern change buttons
		this.renderHeaderButtons(containerEl);

		// Display documentation markdown
		await this.renderDocumentation(containerEl);

		// Render each regex setting
		for (const data of this.plugin.settings.mark) {
			this.renderRegexSetting(containerEl, data);
		}

		// Render add and verify buttons
		this.renderActionButtons(containerEl);
	}

	/**
	 * Creates the header buttons for import/export and pattern changes
	 */
	private renderHeaderButtons(containerEl: HTMLElement) {
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
							await this.display();
						}).open();
					});
			})
			.addButton((button) => {
				button
					.setButtonText("Change property name")
					.setTooltip("Change the property name to search in the frontmatter for view mode autorules options.")
					.onClick(async () => {
						new PropertyModal(this.app, this.settings.propertyName, async (result) => {
							this.plugin.settings.propertyName = result;
							await this.plugin.saveSettings();
						}).open();
					});
			});
	}

	/**
	 * Renders the documentation markdown for the plugin
	 */
	private async renderDocumentation(containerEl: HTMLElement) {
		const pattern = this.stringifyPattern(this.plugin.settings.pattern ?? DEFAULT_PATTERN);

		await MarkdownRenderer.render(
			this.app,
			dedent(`Regex Mark allows to add custom CSS class to text that matches a regex.
			
			If you are not familiar with regex, you can use this tool to help you building regex: [https://regex101.com/](https://regex101.com/). Don't forget to set to **ECMAScript** in the left panel.
			
			You can create custom Markdown Markup with using \`${pattern.open}\` and \`${pattern.close}\`. The open and close regex will be hidden in Live-Preview. You need to use the \`hide\` toggle to make it works.
			
			To activate the toggle, you need to use a **regex group**. See [here for more information](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Groups_and_backreferences).
			
			> [!tip] Named group
			> Named group allows to "granular" match regex. The name will be used as a CSS classes.
			> **Note** : It's pretty experimental so don't expect much!
			> Also, you need to use a named group for **each group** in the regex.
			
			> [!note]
			> - "Overwriting" markdown (for example in \`__underline__\`) won't work in reading mode. But, you can escape the pattern with a backslash: \`\\\` before the mark to disable it! Don't forget it in the regex too.
			> - Using a group in the opening and closing pattern is not supported.
			`),
			containerEl,
			"",
			this.plugin
		);
	}

	/**
	 * Renders a single regex setting item
	 */
	private renderRegexSetting(containerEl: HTMLElement, data: SettingOption) {
		new Setting(containerEl)
			.setClass("regex-setting")
			.addExtraButton((button) => {
				button
					.setIcon("eye")
					.setTooltip("Edit the view mode")
					.onClick(async () => {
						new RemarkRegexOptions(this.app, this.cloneViewMode(data), this.settings.propertyName, async (result) => {
							data.viewMode = result;
							await this.plugin.saveSettings();
							this.plugin.updateCmExtension();
						}).open();
					});
			})
			.addText((text) => this.createRegexInput(text, data))
			.addText((text) => this.createFlagsInput(text, data))
			.addText((text) => this.createClassInput(text, data))
			.addToggle((toggle) => this.createHideToggle(toggle, data))
			.addExtraButton((button) => this.createDeleteButton(button, data))
			.addExtraButton((button) => this.createMoveUpButton(button, data))
			.addExtraButton((button) => this.createMoveDownButton(button, data));

		this.disableToggle(data);
	}

	/**
	 * Creates the regex text input field
	 */
	private createRegexInput(text: any, data: SettingOption) {
		text.inputEl.setAttribute("regex-value", data.regex);

		text.setValue(data.regex).onChange(async (value: string) => {
			data.regex = value;
			await this.plugin.saveSettings();
			text.inputEl.setAttribute("regex-value", data.regex);
			this.disableToggle(data);
		});

		text.inputEl.addClasses(["extra-width", "regex-input"]);
		this.addTooltip("Regex", text.inputEl);
	}

	/**
	 * Creates the flags text input field
	 */
	private createFlagsInput(text: any, data: SettingOption) {
		text.setValue(data.flags?.join("").toLowerCase() ?? "gi").onChange(async (value: string) => {
			text.inputEl.removeClass("is-invalid");
			this.addTooltip("Regex flags", text.inputEl);

			// Filter valid flags and ensure uniqueness
			data.flags = value
				.split("")
				.map((d) => d.toLowerCase())
				.filter(
					(d, index, self) => ["g", "i", "m", "s", "u", "y"].includes(d) && self.indexOf(d) === index
				) as RegexFlags[];

			// Highlight invalid flags
			const invalidFlags = value
				.split("")
				.filter((d, index, self) => !["g", "i", "m", "s", "u", "y"].includes(d) || self.indexOf(d) !== index);

			if (invalidFlags.length > 0) {
				text.inputEl.addClass("is-invalid");
				this.addTooltip("Invalid flags ; they are automatically fixed at save", text.inputEl);
			}

			await this.plugin.saveSettings();
		});

		text.inputEl.addClasses(["min-width", "flags-input"]);
		this.addTooltip("Regex flags", text.inputEl);
	}

	/**
	 * Creates the CSS class input field
	 */
	private createClassInput(text: any, data: SettingOption) {
		text.setValue(data.class).onChange(async (value: string) => {
			data.class = value;
			await this.plugin.saveSettings();
			text.inputEl.setAttribute("css-value", data.class);
		});

		text.inputEl.addClasses(["extra-width", "css-input"]);
		this.addTooltip("Class", text.inputEl);
	}

	/**
	 * Creates the hide toggle button
	 */
	private createHideToggle(toggle: ToggleComponent, data: SettingOption) {
		toggle.toggleEl.addClass("group-toggle");
		this.disableToggle(data);

		toggle.setValue(data.hide ?? false).onChange(async (value: boolean) => {
			data.hide = value;
			await this.plugin.saveSettings();
		});

		this.toggles.set(data, toggle);
	}

	/**
	 * Creates the delete button
	 */
	private createDeleteButton(button: any, data: SettingOption) {
		button
			.setIcon("trash")
			.setTooltip("Delete this regex")
			.onClick(async () => {
				this.plugin.settings.mark = this.plugin.settings.mark.filter((d) => d !== data);
				await this.plugin.saveSettings();
				await this.display();
			});
	}

	/**
	 * Creates the move up button
	 */
	private createMoveUpButton(button: any, data: SettingOption) {
		button
			.setIcon("arrow-up")
			.setTooltip("Move this regex up")
			.onClick(async () => {
				const index = this.plugin.settings.mark.indexOf(data);
				if (index <= 0) return;

				this.plugin.settings.mark.splice(index - 1, 0, this.plugin.settings.mark.splice(index, 1)[0]);
				await this.plugin.saveSettings();
				await this.display();
			});
	}

	/**
	 * Creates the move down button
	 */
	private createMoveDownButton(button: any, data: SettingOption) {
		button
			.setIcon("arrow-down")
			.setTooltip("Move this regex down")
			.onClick(async () => {
				const index = this.plugin.settings.mark.indexOf(data);
				if (index >= this.plugin.settings.mark.length - 1) return;

				this.plugin.settings.mark.splice(index + 1, 0, this.plugin.settings.mark.splice(index, 1)[0]);
				await this.plugin.saveSettings();
				await this.display();
			});
	}

	/**
	 * Renders the add and verify buttons at the bottom of settings
	 */
	private renderActionButtons(containerEl: HTMLElement) {
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
						await this.display();
					});
			})
			.addButton((button) => {
				button
					.setButtonText("Verify & apply")
					.setTooltip("Verify and apply the regexes")
					.onClick(async () => this.verifyAndApplySettings());
			});
	}

	/**
	 * Verifies and applies all regex settings
	 */
	private async verifyAndApplySettings() {
		if (this.findDuplicate()) {
			const validRegex = this.plugin.settings.mark.every((d) => this.verifyRegex(d, this.plugin.settings.pattern));
			const validCss = this.plugin.settings.mark.every((d) => this.verifyClass(d));

			if (validRegex && validCss) {
				try {
					this.plugin.updateCmExtension();
				} catch (e) {
					console.error(e);
					return;
				}
				await this.display();
				new Notice(sanitizeHTMLToDom(`<span class="RegexMark success">🎉 Regexes applied successfully</span>`), 0);
				return;
			}

			// Construct error message
			let msg = "Found ";
			if (!validRegex) msg += "invalid regexes";
			if (!validRegex && !validCss) msg += " and ";
			if (!validCss) msg += "empty css ";
			msg += ". Please fix them before applying.";

			new Notice(sanitizeHTMLToDom(`<span class="RegexMark error">${msg}</span>`));
		} else {
			new Notice("Duplicate regexes found, please fix them before applying.");
		}
	}

	/**
	 * Adds a tooltip to an HTML element
	 */
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
			// biome-ignore lint/correctness/noUndeclaredVariables: activeDocument is declared in the Obsidian API
			activeDocument.querySelector(".tooltip")?.remove();
		};
	}

	/**
	 * Verifies if a regex is valid
	 */
	verifyRegex(data: SettingOption, pattern?: Pattern) {
		const index = this.plugin.settings.mark.indexOf(data);
		const regex = data.regex;
		const inputElement = document.querySelectorAll(".regex-input")[index];

		// Check if regex is empty
		if (regex.trim().length === 0) {
			inputElement?.addClass("is-invalid");
			return false;
		}

		// Use default pattern if not provided
		if (!pattern) pattern = this.plugin.settings.pattern ?? DEFAULT_PATTERN;

		// Validate hide functionality
		if (data.hide && !isValidRegex(removeTags(regex, pattern))) {
			new Notice(sanitizeHTMLToDom(`<span class="RegexMark error">The open/close pattern is not recognized</span>`));
			inputElement?.addClass("is-invalid");
			return false;
		}

		// Check for newline after [^] regex
		if (isInvalid(data.regex)) {
			new Notice(
				sanitizeHTMLToDom(`<span class="RegexMark error">You need to add a new line after the [^] regex</span>`)
			);
			inputElement?.addClass("is-invalid");
			return false;
		}

		// Verify if regex has groups for hiding
		if (data.hide && !hasToHide(data.regex, this.plugin.settings.pattern)) {
			new Notice(
				sanitizeHTMLToDom(`<span class="RegexMark error">You need to use a group in the regex to hide it</span>`)
			);
			data.hide = false;
			this.plugin.saveSettings();
			this.disableToggle(data);
			inputElement?.addClass("is-invalid");
		}

		// Try to create a RegExp object to validate syntax
		try {
			new RegExp(regex);
			inputElement?.removeClass("is-invalid");
			return true;
		} catch (_e) {
			console.warn("Invalid regex", regex);
			inputElement?.addClass("is-invalid");
			return false;
		}
	}

	/**
	 * Verifies if a CSS class is not empty
	 */
	verifyClass(data: SettingOption) {
		const css = data.class;
		const inputElement = document.querySelectorAll(".css-input")[this.plugin.settings.mark.indexOf(data)];

		if (css.trim().length === 0) {
			inputElement?.addClass("is-invalid");
			return false;
		}

		inputElement?.removeClass("is-invalid");
		return true;
	}

	/**
	 * Gets the regex value from input element
	 */
	private getRegexFromInput(data: SettingOption) {
		const index = this.plugin.settings.mark.indexOf(data);
		const input = document.querySelectorAll<HTMLElement>(".regex-input")[index];

		if (input) {
			const regex = input.getAttribute("regex-value");
			if (regex) return regex;
		}

		return data.regex;
	}

	/**
	 * Checks if the regex is valid for the hide toggle
	 */
	private verifyRegexFromInput(data: SettingOption) {
		const regex = this.getRegexFromInput(data);

		if (regex.trim().length === 0) {
			return true; // Consider empty regex as invalid for hiding
		}

		return !hasToHide(regex, this.settings.pattern) || !isValidRegex(regex, false, this.settings.pattern);
	}

	/**
	 * Finds duplicate regexes in settings
	 * @returns true if no duplicates found, false otherwise
	 */
	findDuplicate() {
		const duplicateIndex: {
			regex: string;
			index: number[];
		}[] = [];

		// Remove all invalid markers
		document.querySelectorAll(".is-invalid").forEach((d) => d.removeClass("is-invalid"));

		// Find duplicates
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

		// Mark duplicates as invalid
		const allDuplicateIndex = duplicateIndex.flatMap((d) => (d.index.length > 1 ? d.index : []));

		if (allDuplicateIndex.length === 0) return true;

		for (const duplicate of allDuplicateIndex) {
			const element = document.querySelectorAll(".regex-input")[duplicate];
			element?.addClass("is-invalid");

			const regex = this.plugin.settings.mark[duplicate].regex;
			new Notice(`Duplicate regex: ${regex}.`);
		}

		return false;
	}
}
