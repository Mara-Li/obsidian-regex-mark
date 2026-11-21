import type { SettingDefinitionItem } from "obsidian";

/**
 * A single full-width "Delete" button, with `tooltip` explaining what it removes
 */
export function deleteButton(tooltip: string, onDelete: () => void): SettingDefinitionItem {
	return {
		// Only used by the framework (the label is hidden by the css)
		name: "Delete",
		searchable: false,
		render: (setting) => {
			setting.settingEl.addClass("regex-delete");
			setting.addButton((button) =>
				button.setButtonText("Delete").setTooltip(tooltip).setDestructive().onClick(onDelete)
			);
		},
	};
}
