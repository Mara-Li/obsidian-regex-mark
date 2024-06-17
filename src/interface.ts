export interface SettingOption {
	/**
	 * Regex to match the text
	 */
	regex: string;
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

export type SettingOptions = SettingOption[];

export type ViewMode = {
	reading: boolean;
	source: boolean;
	live: boolean;
};

export const DEFAULT_VIEW_MODE: ViewMode = {
	reading: true,
	source: true,
	live: true,
};
