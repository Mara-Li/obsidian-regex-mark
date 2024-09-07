export interface SettingOption {
	/**
	 * Regex to match the text
	 */
	regex: string;
	/**
	 * Regex flags
	 * @default ['g', 'i']
	 */
	flags?: RegexFlags[];
	/**
	 * The associated css class
	 */
	class: string;
	/**
	 * If the regex have a group {{open}} and {{close}} and the open/close should be hidden
	 */
	hide?: boolean;
	/**
	 * @deprecated
	 * Now disable is handled by the view mode
	 */
	disable?: boolean;
	/**
	 * Application view of the regex
	 * Include the disable option
	 */
	viewMode?: ViewMode;
}

export type SettingOptions = {
	mark: Mark;
	pattern?: Pattern;
};

export type Pattern = {
	open: string;
	close: string;
};

export const DEFAULT_PATTERN: Pattern = {
	open: `{{open:(.*?)}}`,
	close: `{{close:(.*?)}}`,
};

export const DEFAULT_SETTINGS: SettingOptions = {
	mark: [],
	pattern: DEFAULT_PATTERN,
};

export type Mark = SettingOption[];

export type ViewMode = {
	reading: boolean;
	source: boolean;
	live: boolean;
	codeBlock?: boolean;
};

export const DEFAULT_VIEW_MODE: ViewMode = {
	reading: true,
	source: true,
	live: true,
};

export type RegexFlags = "g" | "i" | "m" | "s" | "u" | "y";
