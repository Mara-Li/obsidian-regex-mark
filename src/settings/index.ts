import { cloneDeep } from "lodash";
import {
	type App,
	Component,
	MarkdownRenderer,
	Notice,
	PluginSettingTab,
	Setting,
	sanitizeHTMLToDom,
	type TextComponent,
	type ToggleComponent,
} from "obsidian";
import { dedent } from "ts-dedent";
import {
	DEFAULT_PATTERN,
	DEFAULT_VIEW_MODE,
	LEGAL_REGEX_FLAGS,
	type MarkRuleObj,
	type PatternObj,
	type RegexFlags,
	type ViewMode,
} from "../interface";
import type RegexMark from "../main";
import { type MarkRule, MarkRuleErrorCode, Pattern, type SettingOptions } from "../model";
import { RemarkPatternTab } from "./change_pattern";
import { ExportSettings, ImportSettings } from "./import_export";
import { PropertyModal } from "./property_name";
import { RemarkRegexOptions } from "./viewModal";

export class RemarkRegexSettingTab extends PluginSettingTab {
	plugin: RegexMark;
	settings: SettingOptions;
	toggles: Map<MarkRule, ToggleComponent> = new Map();

	constructor(app: App, plugin: RegexMark) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = plugin.settings;
	}

	/**
	 * Disable the toggle option if the regex doesn't contain any group
	 * @param data - The setting option containing regex information
	 */
	disableToggle(data: MarkRule) {
		const hasNoPatterns = !data.hasPatterns();
		const toggleComponent = this.toggles.get(data);

		if (toggleComponent) {
			toggleComponent.toggleEl.toggleClass("is-disabled-manually", hasNoPatterns);
			toggleComponent.setDisabled(hasNoPatterns);

			const tooltip = hasNoPatterns
				? "Can't hide the regex if no group is found in it."
				: "Hide the regex in Live-Preview, only keeping the content.";

			toggleComponent.setTooltip(tooltip);
		}
	}

	/**
	 * Create a deep copy of the view mode
	 */
	cloneViewMode(mode: MarkRuleObj): ViewMode {
		return cloneDeep(mode.viewMode ?? DEFAULT_VIEW_MODE);
	}

	/**
	 * Create a deep copy of the _patternRegex configuration
	 */
	clonePattern(options: SettingOptions): PatternObj {
		return cloneDeep(options.pattern);
	}

	/**
	 * Updates all regex patterns when the open/close tags are changed
	 */
	async updateRegexPattern(newPattern: PatternObj) {
		const notValid = this.settings.changePattern(Pattern.from(newPattern));

		// Show notification for invalid regexes
		if (notValid.length > 0) {
			const htmlList = notValid.map((d) => `<li class="error"><code>${d.regexRaw}</code></li>`).join("");
			new Notice(
				sanitizeHTMLToDom(
					`<span class="RegexMark error">The following regexes became invalid: <ul>${htmlList}</ul></span>`
				),
				0
			);
		}
	}

	/**
	 * Creates a user-friendly representation of _patternRegex
	 */
	stringifyPattern(pattern: PatternObj) {
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

		// Render header with import/export and _patternRegex change buttons
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
	 * Creates the header buttons for import/export and _patternRegex changes
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
							await this.updateRegexPattern(result);
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
						}).open();
					});
			});
	}

	/**
	 * Renders the documentation markdown for the plugin
	 */
	private async renderDocumentation(containerEl: HTMLElement) {
		const pattern = this.stringifyPattern(this.plugin.settings.pattern ?? DEFAULT_PATTERN);

		const component = new Component();
		component.load();

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
			> Moreover, the named group won't be displayed when the cursor is on the line or in source mode.
			> When the cursor is on the line (or in source mode), only the main class will be displayed.
			
			> [!note]
			> - "Overwriting" markdown (for example in \`__underline__\`) won't work in reading mode. But, you can escape the pattern with a backslash: \`\\\` before the mark to disable it! Don't forget it in the regex too.
			> - Using a group in the opening and closing pattern is not supported.
			`),
			containerEl,
			"",
			component
		);
		component.unload();
	}

	/**
	 * Renders a single regex setting item
	 */
	private renderRegexSetting(containerEl: HTMLElement, data: MarkRule) {
		new Setting(containerEl)
			.setClass("regex-setting")
			.addExtraButton((button) => {
				button
					.setIcon("eye")
					.setTooltip("Edit the view mode")
					.onClick(async () => {
						new RemarkRegexOptions(this.app, cloneDeep(data.viewMode), this.settings.propertyName, async (result) => {
							data.viewMode = result;
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
	private createRegexInput(text: TextComponent, data: MarkRule) {
		text.inputEl.setAttribute("regex-value", data.regexRaw);

		text.setValue(data.regexRaw).onChange(async (value: string) => {
			data.regexRaw = value;
			text.inputEl.setAttribute("regex-value", data.regexRaw);
			this.disableToggle(data);
		});

		text.inputEl.addClasses(["extra-width", "regex-input"]);
		this.addTooltip("Regex", text.inputEl);
	}

	/**
	 * Creates the #flags text input field
	 */
	private createFlagsInput(text: TextComponent, data: MarkRule) {
		text.setValue([...data.flags].join("")).onChange(async (value: string) => {
			text.inputEl.removeClass("is-invalid");
			this.addTooltip("Regex #flags", text.inputEl);

			data.flags = value;

			// Highlight invalid #flags
			const invalidFlags = value
				.split("")
				.filter((d: RegexFlags, index, self) => !LEGAL_REGEX_FLAGS.includes(d) || self.indexOf(d) !== index);

			if (invalidFlags.length > 0) {
				text.inputEl.addClass("is-invalid");
				this.addTooltip("Invalid #flags ; they are automatically fixed at save", text.inputEl);
			}
			text.setValue([...data.flags].join(""));
		});

		text.inputEl.addClasses(["min-width", "#flags-input"]);
		this.addTooltip("Regex #flags", text.inputEl);
	}

	/**
	 * Creates the CSS class input field
	 */
	private createClassInput(text: any, data: MarkRule) {
		text.setValue(data.class).onChange(async (value: string) => {
			data.class = value;
			text.inputEl.setAttribute("css-value", data.class);
		});

		text.inputEl.addClasses(["extra-width", "css-input"]);
		this.addTooltip("Class", text.inputEl);
	}

	/**
	 * Creates the hide toggle button
	 */
	private createHideToggle(toggle: ToggleComponent, data: MarkRule) {
		toggle.toggleEl.addClass("group-toggle");
		this.disableToggle(data);

		toggle.setValue(data.hide ?? false).onChange(async (value: boolean) => {
			data.hide = value;
		});

		this.toggles.set(data, toggle);
	}

	/**
	 * Creates the delete button
	 */
	private createDeleteButton(button: any, data: MarkRule) {
		button
			.setIcon("trash")
			.setTooltip("Delete this regex")
			.onClick(async () => {
				this.plugin.settings.removeMark(data);
				await this.display();
			});
	}

	/**
	 * Creates the move up button
	 */
	private createMoveUpButton(button: any, data: MarkRule) {
		button
			.setIcon("arrow-up")
			.setTooltip("Move this regex up")
			.onClick(async () => {
				this.plugin.settings.moveMarkIndex(data, -1);
				await this.display();
			});
	}

	/**
	 * Creates the move down button
	 */
	private createMoveDownButton(button: any, data: MarkRule) {
		button
			.setIcon("arrow-down")
			.setTooltip("Move this regex down")
			.onClick(async () => {
				this.plugin.settings.moveMarkIndex(data, 1);
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
						this.plugin.settings.addNewMark();
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
		if (this.verifyDuplicates()) {
			const validRules = (
				await Promise.all(this.plugin.settings.mark.map((d) => this.verifyRule(d, this.plugin.settings.pattern)))
			).every((a) => a);

			if (validRules) {
				try {
					await this.plugin.applyChanges();
				} catch (e) {
					console.error(e);
					return;
				}
				await this.display();
				new Notice(sanitizeHTMLToDom(`<span class="RegexMark success">🎉 Regexes applied successfully</span>`));
				return;
			} else {
				new Notice(
					sanitizeHTMLToDom(
						`<span class="RegexMark error">"Found invalid Inputs. Please fix them before applying."</span>`
					)
				);
			}
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
	 * Verifies if a single rule is valid
	 */
	async verifyRule(data: MarkRule, pattern?: PatternObj) {
		const index = this.plugin.settings.mark.indexOf(data);
		const inputElement = document.querySelectorAll(".regex-input")[index];
		const inputCss = document.querySelectorAll(".css-input")[index];

		if (data.isValide()) {
			inputElement?.removeClass("is-invalid");
			inputCss?.removeClass("is-invalid");
			return true;
		} else {
			for (const error of data.getErrors()) {
				if (error === MarkRuleErrorCode.ClassMissing) {
					inputCss?.addClass("is-invalid");
				} else {
					inputElement?.addClass("is-invalid");
				}
				new Notice(sanitizeHTMLToDom(`<span class="RegexMark error">${error}</span>`));
			}
			return false;
		}
	}

	/**
	 * Gets the regex value from input element
	 */
	private getRegexFromInput(data: MarkRule) {
		const index = this.plugin.settings.mark.indexOf(data);
		const input = document.querySelectorAll<HTMLElement>(".regex-input")[index];

		if (input) {
			const regex = input.getAttribute("regex-value");
			if (regex) return regex;
		}

		return data.regexRaw;
	}

	/**
	 * Checks if the regex is valid for the hide toggle
	 */
	private verifyRegexFromInput(data: MarkRule): MarkRuleErrorCode[] {
		const newRegex = this.getRegexFromInput(data);
		const clone = data.clone();
		clone.regexRaw = newRegex;

		return [...clone.getErrors()];
	}

	/**
	 * Finds duplicate regexes in settings
	 * @returns true if no duplicates found, false otherwise
	 */
	verifyDuplicates() {
		// Remove all invalid markers
		document.querySelectorAll(".is-invalid").forEach((d) => d.removeClass("is-invalid"));

		const allDuplicateIndex = this.settings.getDuplicateIndexes();

		// Mark duplicates as invalid
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
