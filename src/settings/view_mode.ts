import { cloneDeep } from "lodash";
import { Notice, type SettingDefinitionItem, type SettingGroupItem, sanitizeHTMLToDom } from "obsidian";
import { type AutoRules, DEFAULT_VIEW_MODE, type ViewMode } from "../interface";
import type { MarkRule } from "../model";
import { uniqueNames } from "../utils";
import { managePage } from "./manage_page";

export interface ViewModeContext {
	/**
	 * Register a getter/setter pair and return the key to use in a `control` definition
	 */
	bind<T>(get: () => T, set: (value: T) => void): string;
	/**
	 * Rebuild the definitions of the tab
	 */
	refresh(): void;
	/**
	 * Go back to the parent page
	 * @returns `false` when it is not possible
	 */
	goBack(): boolean;
	propertyName(): string;
}

function describeAutoRule(auto: AutoRules) {
	const mode = auto.exclude ? "Not" : "Equal";
	const type = auto.type === "path" ? "path" : "property";
	return `${mode} ${type}: ${auto.value || "…"}`;
}

/**
 * Settings allowing to choose where a rule is applied (modes, code and auto rules)
 */
export function viewModeDefinitions(ctx: ViewModeContext, rule: MarkRule): SettingDefinitionItem[] {
	const view = (): ViewMode => rule.viewMode ?? DEFAULT_VIEW_MODE;

	/**
	 * Apply a modification on the view mode of the rule, and notify the rule of the change.
	 * The default view mode is shared, so it is copied before being modified.
	 */
	const mutate = (fn: (viewMode: ViewMode) => void) => {
		const viewMode =
			rule.viewMode && rule.viewMode !== DEFAULT_VIEW_MODE ? rule.viewMode : cloneDeep(DEFAULT_VIEW_MODE);
		fn(viewMode);
		rule.viewMode = viewMode;
	};

	const toggle = (name: string, desc: string, get: () => boolean, set: (value: boolean) => void) => ({
		name,
		desc,
		control: { type: "toggle" as const, key: ctx.bind(get, set) },
	});

	const autoRules = view().autoRules ?? [];

	return [
		{
			type: "group",
			heading: "View mode",
			items: [
				toggle(
					"Reading mode",
					"Apply the regex to the reading mode",
					() => view().reading,
					(value) => mutate((vm) => (vm.reading = value))
				),
				toggle(
					"Source mode",
					"Note: In source mode, open and close tags are not hidden. It will just enable the css class.",
					() => view().source,
					(value) => mutate((vm) => (vm.source = value))
				),
				toggle(
					"Live mode",
					"Apply the regex to the live mode",
					() => view().live,
					(value) => mutate((vm) => (vm.live = value))
				),
				toggle(
					"Code",
					"Apply the regex when the text is within code (inline or block).",
					() => view().codeBlock ?? true,
					(value) => mutate((vm) => (vm.codeBlock = value))
				),
			],
		},
		{
			type: "list",
			heading: "Auto rules",
			emptyState: sanitizeHTMLToDom(
				`No auto rule. They include or exclude the regex based on the file path or the frontmatter value of <code>${ctx.propertyName()}</code>.`
			),
			addItem: {
				name: "Add auto rule",
				action: () => {
					mutate((vm) => {
						vm.autoRules = vm.autoRules ?? [];
						vm.autoRules.push({ type: "path", value: "", exclude: false });
					});
					ctx.refresh();
				},
			},
			items: autoRules.map(
				(auto, index): SettingGroupItem =>
					({
						type: "page",
						// Stable even when the name changes, see `RemarkRegexSettingTab#rulesDefinition`
						id: `auto-rule-${index}`,
						// A getter, so the name follows the value without rebuilding the definitions
						get name() {
							const list = view().autoRules ?? [];
							return uniqueNames(list.map(describeAutoRule))[list.indexOf(auto)] ?? describeAutoRule(auto);
						},
						items: [
							{
								name: "Condition",
								control: {
									type: "dropdown",
									key: ctx.bind(
										() => (auto.exclude ? "not" : "equal"),
										(value) => mutate(() => (auto.exclude = value === "not"))
									),
									options: { equal: "Equal", not: "Not" },
								},
							},
							{
								name: "Type",
								control: {
									type: "dropdown",
									key: ctx.bind(
										() => auto.type,
										(value) => mutate(() => (auto.type = value as AutoRules["type"]))
									),
									options: { path: "Path", frontmatter: "Properties" },
								},
							},
							{
								name: "Value",
								desc: "A regex or a string.",
								control: {
									type: "text",
									key: ctx.bind(
										() => auto.value,
										(value) => mutate(() => (auto.value = value))
									),
									placeholder: "Enter a regex or a string",
									validate: (value) => {
										try {
											new RegExp(value);
										} catch {
											return "Invalid regular expression";
										}
									},
								},
							},
							{
								type: "group",
								items: [
									{
										name: "Delete this auto rule",
										render: (setting) => {
											setting.addButton((button) =>
												button
													.setButtonText("Delete")
													.setWarning()
													.onClick(() => {
														mutate((vm) => vm.autoRules?.splice(vm.autoRules.indexOf(auto), 1));
														ctx.refresh();
														new Notice(ctx.goBack() ? "Auto rule deleted." : "Auto rule deleted, you can go back.");
													})
											);
										},
									},
								],
							},
						],
					}) as SettingGroupItem
			),
		},
		// The pages of the list can't be reordered by the list itself
		managePage({
			id: "manage-auto-rules",
			name: "Reorder auto rules",
			desc: "The first rule that applies wins.",
			emptyState: "No auto rule.",
			visible: () => (view().autoRules?.length ?? 0) > 1,
			rows: autoRules.map((auto) => ({
				get name() {
					return describeAutoRule(auto);
				},
			})),
			onReorder: (oldIndex, newIndex) => {
				mutate((vm) => {
					const list = vm.autoRules ?? [];
					const [moved] = list.splice(oldIndex, 1);
					list.splice(newIndex, 0, moved);
				});
				// A drag only moves the DOM, the list of auto rules needs to be rebuilt to follow the new order
				ctx.refresh();
			},
		}),
	];
}
