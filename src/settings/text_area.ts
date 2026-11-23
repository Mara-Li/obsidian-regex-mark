import type { SettingDefinitionItem } from "obsidian";

export type TextAreaFieldOptions = {
	name: string;
	desc: string;
	placeholder?: string;
	rows?: number;
	get: () => string;
	set: (value: string) => void;
	/** @returns The error message, if any: the value is only saved when it is valid */
	validate?: (value: string) => string | undefined;
	/** Called after a valid value is saved, to update the settings that depend on it */
	onSaved?: () => void;
};

/**
 * A full-width monospace textarea.
 * The declarative `textarea` control can't have a class, so the field is rendered by hand.
 */
export function textAreaField(options: TextAreaFieldOptions): SettingDefinitionItem {
	const { name, desc, placeholder, rows = 4, get, set, validate, onSaved } = options;
	return {
		name,
		desc,
		render: (setting) => {
			setting.settingEl.addClass("regex-mark-textarea-setting");
			const errorEl = setting.descEl.createDiv({ cls: "regex-mark-field-error" });

			const showError = (inputEl: HTMLTextAreaElement, error: string | undefined) => {
				inputEl.toggleClass("error", !!error);
				errorEl.setText(error ?? "");
				errorEl.toggleClass("active", !!error);
			};

			setting.addTextArea((text) => {
				text.inputEl.addClass("regex-mark-textarea");
				text.inputEl.rows = rows;
				if (placeholder) text.setPlaceholder(placeholder);
				text.setValue(get());
				// A new rule is empty: no need to show an error before it is filled
				if (get()) showError(text.inputEl, validate?.(get()));

				text.onChange((value) => {
					const error = validate?.(value);
					showError(text.inputEl, error);
					if (error) return;
					set(value);
					onSaved?.();
				});
			});
		},
	};
}
