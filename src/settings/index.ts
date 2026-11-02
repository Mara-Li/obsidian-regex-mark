import { cloneDeep } from "lodash";
import {
	type App,
	Component,
	MarkdownRenderer,
	Notice,
	PluginSettingTab,
	type SettingDefinitionItem,
	type SettingGroupItem,
	sanitizeHTMLToDom,
} from "obsidian";
import { dedent } from "ts-dedent";
import { DEFAULT_PATTERN, LEGAL_REGEX_FLAGS, type PatternObj, type RegexFlags } from "../interface";
import type RegexMark from "../main";
import { type MarkRule, MarkRuleErrorCode, Pattern, type SettingOptions } from "../model";
import { uniqueNames } from "../utils";
import { PatternPage } from "./change_pattern";
import { ExportPage, ImportPage } from "./import_export";
import { managePage } from "./manage_page";
import { viewModeDefinitions } from "./view_mode";

type Binding = {
	get: () => unknown;
	set: (value: unknown) => void;
};

export class RemarkRegexSettingTab extends PluginSettingTab {
	plugin: RegexMark;
	/**
	 * Getters/setters used by the `control` definitions. Rebuilt with the definitions.
	 */
	private bindings: Map<string, Binding> = new Map();
	private ruleIds: WeakMap<MarkRule, string> = new WeakMap();
	private nextRuleId = 0;

	constructor(app: App, plugin: RegexMark) {
		super(app, plugin);
		this.plugin = plugin;
		this.containerEl.addClass("RegexMark");
	}

	get settings(): SettingOptions {
		return this.plugin.settings;
	}

	/**
	 * Register a getter/setter pair and return the key to use in a `control` definition.
	 * The rules are not stored as flat keys of the settings, so each control gets its own binding.
	 */
	bind<T>(get: () => T, set: (value: T) => void): string {
		const key = `binding-${this.bindings.size}`;
		this.bindings.set(key, { get, set: (value) => set(value as T) });
		return key;
	}

	/**
	 * Go back to the parent page, as the back button does.
	 * The public API has no method for that, so it uses the one of the settings modal if it exists.
	 * @returns `false` when it is not possible
	 */
	goBack(): boolean {
		const modal = (this.app as unknown as { setting?: { closePage?: () => void } }).setting;
		if (typeof modal?.closePage !== "function") return false;
		modal.closePage();
		return true;
	}

	getControlValue(key: string): unknown {
		return this.bindings.get(key)?.get();
	}

	setControlValue(key: string, value: unknown): void {
		// The model notifies the plugin, which saves and applies the change
		this.bindings.get(key)?.set(value);
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
		this.update();
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

	getSettingDefinitions(): SettingDefinitionItem[] {
		this.bindings.clear();

		return [
			{
				type: "group",
				items: [
					{
						type: "page",
						name: "Import",
						desc: "Import regexes from other users.",
						page: () =>
							new ImportPage(this.settings, () => {
								this.update();
							}),
					},
					{
						type: "page",
						name: "Export",
						desc: "Export your regexes to share them with other users.",
						page: () => new ExportPage(this.settings),
					},
					{
						type: "page",
						name: "Change open/close tags",
						desc: "Advanced user only! Allow to change the tags for hiding element.",
						displayValue: () => {
							const { open, close } = this.stringifyPattern(this.settings.pattern ?? DEFAULT_PATTERN);
							return `${open} … ${close}`;
						},
						page: () =>
							new PatternPage(this.app, cloneDeep(this.settings.pattern.serialize()), (result) =>
								this.updateRegexPattern(result)
							),
					},
					{
						type: "page",
						name: "Change property name",
						desc: "Change the property name to search in the frontmatter for view mode autorules options.",
						displayValue: () => this.settings.propertyName,
						items: [
							{
								name: "Property name",
								desc: "The property name to search in the frontmatter",
								control: {
									type: "text",
									key: this.bind(
										() => this.settings.propertyName,
										(value) => {
											this.settings.propertyName = value;
										}
									),
									validate: (value) => (value.trim() ? undefined : "The property name can't be empty."),
								},
							},
						],
					},
				],
			},
			this.documentationDefinition(),
			...this.rulesDefinitions(),
		];
	}

	/**
	 * Renders the documentation markdown for the plugin
	 */
	private documentationDefinition(): SettingDefinitionItem {
		return {
			name: "Documentation",
			searchable: false,
			render: (setting) => {
				setting.settingEl.addClass("regex-documentation");
				const pattern = this.stringifyPattern(this.settings.pattern ?? DEFAULT_PATTERN);

				const component = new Component();
				component.load();

				void MarkdownRenderer.render(
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
					setting.settingEl,
					"",
					component
				);
				return () => component.unload();
			},
		};
	}

	/**
	 * The list of regexes: each one is a page, so every field has the full width of the screen
	 */
	private rulesDefinitions(): SettingDefinitionItem[] {
		const ruleName = (rule: MarkRule) => this.ruleName(rule);

		const list: SettingDefinitionItem = {
			type: "list",
			heading: "Regexes",
			emptyState: "No regex yet.",
			addItem: {
				name: "Add regex",
				action: () => {
					this.settings.addNewMark();
					this.update();
				},
			},
			items: this.settings.mark.map(
				(rule): SettingGroupItem =>
					({
						type: "page",
						// The pages are found again with their id: it needs to stay the same when the name changes
						id: this.ruleId(rule),
						// A getter, so the name follows the class without rebuilding the definitions
						get name() {
							return ruleName(rule);
						},
						displayValue: () => rule.regexRaw,
						status: () => (rule.isValide() ? null : "warning"),
						items: this.ruleDefinitions(rule),
					}) as SettingGroupItem
			),
		};

		// The pages of the list can't be reordered by the list itself
		const manage: SettingDefinitionItem = {
			type: "group",
			items: [
				managePage({
					id: "manage-rules",
					name: "Reorder regexes",
					desc: "The order is the order of application.",
					emptyState: "No regex.",
					visible: () => this.settings.mark.length > 1,
					rows: this.settings.mark.map((rule) => ({
						get name() {
							return ruleName(rule);
						},
						get desc() {
							return rule.regexRaw;
						},
					})),
					onReorder: (oldIndex, newIndex) => {
						this.settings.reorderMark(oldIndex, newIndex);
						// A drag only moves the DOM, the list of regexes needs to be rebuilt to follow the new order
						this.update();
					},
				}),
			],
		};

		return [list, manage];
	}

	private ruleId(rule: MarkRule): string {
		let id = this.ruleIds.get(rule);
		if (!id) {
			id = `rule-${this.nextRuleId++}`;
			this.ruleIds.set(rule, id);
		}
		return id;
	}

	/**
	 * The title of the page of a rule: its class, made unique among the other rules
	 */
	private ruleName(rule: MarkRule): string {
		const marks = this.settings.mark;
		const label = rule.class || "New regex";
		const index = marks.indexOf(rule);
		if (index < 0) return label;
		return uniqueNames(marks.map((mark) => mark.class || "New regex"))[index];
	}

	private ruleDefinitions(rule: MarkRule): SettingDefinitionItem[] {
		return [
			{
				name: "Regex",
				desc: "The regex used to find the text.",
				control: {
					type: "text",
					key: this.bind(
						() => rule.regexRaw,
						(value) => {
							rule.regexRaw = value;
						}
					),
					placeholder: "Regex",
					validate: (value) => this.validateRegex(rule, value),
				},
			},
			{
				name: "Flags",
				desc: "Regex flags, for example `gi`.",
				control: {
					type: "text",
					key: this.bind(
						() => [...rule.flags].join(""),
						(value) => {
							rule.flags = value;
						}
					),
					placeholder: "gi",
					validate: (value) => {
						const invalidFlags = value
							.split("")
							.filter(
								(flag, index, self) => !LEGAL_REGEX_FLAGS.includes(flag as RegexFlags) || self.indexOf(flag) !== index
							);
						if (invalidFlags.length > 0) return `Invalid flags: ${invalidFlags.join("")}`;
					},
				},
			},
			{
				name: "Class",
				desc: "The CSS class added to the matched text.",
				control: {
					type: "text",
					key: this.bind(
						() => rule.class,
						(value) => {
							rule.class = value;
						}
					),
					placeholder: "Class",
					validate: (value) => (value.trim() ? undefined : MarkRuleErrorCode.ClassMissing),
				},
			},
			{
				name: "Hide open/close tags",
				desc: "Hide the regex in Live-Preview, only keeping the content. Needs a group in the regex.",
				control: {
					type: "toggle",
					key: this.bind(
						() => rule.hide ?? false,
						(value) => {
							rule.hide = value;
						}
					),
					disabled: () => !rule.hasPatterns(),
				},
			},
			...viewModeDefinitions(
				{
					bind: (get, set) => this.bind(get, set),
					refresh: () => this.update(),
					goBack: () => this.goBack(),
					propertyName: () => this.settings.propertyName,
				},
				rule
			),
			{
				type: "group",
				items: [
					{
						name: "Delete this regex",
						desc: "Remove the regex and its settings.",
						render: (setting) => {
							setting.addButton((button) =>
								button
									.setButtonText("Delete")
									.setDestructive()
									.onClick(() => {
										this.settings.removeMark(rule);
										this.update();
										new Notice(this.goBack() ? "Regex deleted." : "Regex deleted, you can go back.");
									})
							);
						},
					},
				],
			},
		];
	}

	/**
	 * Validate a candidate regex for a rule, without modifying it
	 * @returns The error message, if any
	 */
	private validateRegex(rule: MarkRule, value: string): string | undefined {
		const candidate = rule.clone();
		candidate.regexRaw = value;
		for (const error of candidate.getErrors()) {
			if (error !== MarkRuleErrorCode.ClassMissing) return error;
		}
		if (this.settings.mark.some((other) => other !== rule && other.regexRaw === value)) {
			return "This regex already exists.";
		}
	}
}
