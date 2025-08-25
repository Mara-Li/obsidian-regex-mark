import { MarkRule } from "./model";

export interface MarkRuleObj {
	/**
	 * Regex to match the text
	 */
	regex: string;
	/**
	 * Regex #flags
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

/**
 * @deprecated
 */
export type SettingOptionsObj0 = MarkRuleObj[];

export type SettingOptionsObj = {
	mark: MarkRuleObj[];
	pattern?: PatternObj;
	/**
	 * Property name to search in the frontmatter
	 */
	propertyName: string;
};

export type PatternObj = {
	open: string;
	close: string;
};

export const DEFAULT_PATTERN: PatternObj = {
	open: `{{open:(.*?)}}`,
	close: `{{close:(.*?)}}`,
};
export const DEFAULT_PROPERTYNAME = "regex_mark";

export const DEFAULT_SETTINGS: SettingOptionsObj = {
	mark: [],
	pattern: DEFAULT_PATTERN,
	propertyName: DEFAULT_PROPERTYNAME,
};

export type ViewMode = {
	reading: boolean;
	source: boolean;
	live: boolean;
	codeBlock?: boolean;
	autoRules?: AutoRules[];
};

export type AutoRules = {
	type: "path" | "frontmatter";
	/**
	 * Can be a regex or a string;
	 */
	value: string;
	/**
	 * If true, the rule will be used to exclude the regex from the view instead of including it
	 */
	exclude?: boolean;
};

export type RegexString = string;

export const DEFAULT_VIEW_MODE: ViewMode = {
	reading: true,
	source: true,
	live: true,
	codeBlock: true,
};

export type RegexFlags = "g" | "i" | "m" | "s" | "u" | "y"; // "d" intentionally unusable
export const LEGAL_REGEX_FLAGS: RegexFlags[] = ["g", "i", "m", "s", "u", "y"];
