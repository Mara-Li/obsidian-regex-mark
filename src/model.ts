import * as console from "console";
import type { App, MarkdownViewModeType } from "obsidian";
import {
	type AutoRules,
	DEFAULT_PATTERN,
	DEFAULT_PROPERTYNAME,
	DEFAULT_VIEW_MODE,
	LEGAL_REGEX_FLAGS,
	type MarkRuleObj,
	type PatternObj,
	type RegexFlags,
	type RegexString,
	type SettingOptionsObj,
	type SettingOptionsObj0,
	type ViewMode,
} from "./interface";
import type RegexMark from "./main";
import {
	extractGroups,
	getFile,
	getFrontmatter,
	regexMayMatchNewlineCharacter,
	removeTags,
	valideRegexSyntax,
} from "./utils";

export enum MarkRuleErrorCode {
	RegexMissing = "Regex is missing",
	RegexSyntaxError = "Regex has a syntax Error",
	RegexMatchesNewline = "Regex can match newlines (`\\n`). This can happen in `[^]` groups or with `\\s`",
	RegexHideMissingPatterns = "Open/close tags are is hidden, but the regex does not have any",
	ClassMissing = "Css class is missing",
}
export enum PatternErrorCode {
	NotOpen = "Pattern doesn't contain 'open:'",
	NotClose = "Pattern doesn't contain 'close:'",
	Empty = "Pattern is empty",
	Invalid = "Pattern is invalid",
	WithoutGroup = "Pattern doesn't contain a group",
	NeedChar = "Pattern need to contain a character for enclosing",
}

abstract class ModelObject<SerializedObj, ErrorCode> {
	private _onChange: Set<() => any> = new Set();

	public isValide() {
		return this.getErrors().next().done;
	}

	/**
	 * Get Errors produced by this Element or its children as a (finite) Generator
	 * @example [...obj.getErrors()] for full list
	 */
	public abstract getErrors(): Generator<ErrorCode>;
	public abstract serialize(): SerializedObj;

	/**
	 * Will be invoked when the object changes
	 * @param func
	 */
	public addOnChange(func: () => any): this {
		this._onChange.add(func);
		return this;
	}
	public removeOnChange(func: () => any): this {
		this._onChange.delete(func);
		return this;
	}

	protected _invokeOnChange() {
		this._onChange.forEach((f) => f());
	}
}

export class MarkRule extends ModelObject<MarkRuleObj, MarkRuleErrorCode> {
	//#region properties
	private readonly _settings: SettingOptions;
	/**
	 * Regex to match the text
	 */
	#regexRaw: RegexString;
	get regexRaw() {
		return this.#regexRaw;
	}
	set regexRaw(val) {
		this.#regexRaw = val;
		this._invokeOnChange();
	}
	/**
	 * Regex #flags
	 * @default ['g', 'i']
	 */
	#flags: Set<RegexFlags>;
	get flags() {
		return this.#flags;
	}
	set flags(val: Set<RegexFlags> | RegexFlags[] | string) {
		// Filter valid #flags and ensure uniqueness
		if (typeof val === "string") {
			val = val
				.toLowerCase()
				.split("")
				.filter((f: RegexFlags) => LEGAL_REGEX_FLAGS.includes(f)) as RegexFlags[];
		}
		if (Array.isArray(val)) val = new Set(val);
		this.#flags = val;
		this._invokeOnChange();
	}
	/**
	 * The associated css class
	 */
	#class: string;
	set class(val) {
		this.#class = val;
	}
	get class() {
		return this.#class;
	}
	/**
	 * If the regex have a group {{open}} and {{close}} and the open/close should be hidden
	 */
	#hide?: boolean;
	set hide(val) {
		this.#hide = val;
	}
	get hide() {
		return this.#hide;
	}
	/**
	 * Application view of the regex
	 * Include the disable option
	 */
	#viewMode: ViewMode;
	get viewMode() {
		return this.#viewMode;
	}
	set viewMode(val) {
		this.#viewMode = val;
		this._invokeOnChange();
	}

	/**
	 * The Regex from {@link #regexRaw} with applied {@link #flags}
	 */
	get regex() {
		return new RegExp(this.regexString, this.flagsString);
	}

	/**
	 * The Subregex of the {@link SettingOptions#pattern}
	 */
	get patternSubRegex() {
		const pattern = this._settings.patternRegex,
			openMatchString = pattern.open.exec(this.#regexRaw)?.[1],
			closeMatchString = pattern.close.exec(this.#regexRaw)?.[1];

		return {
			open: openMatchString ? new RegExp(`^${openMatchString}`) : null,
			close: closeMatchString ? new RegExp(`${closeMatchString}$`) : null,
		};
	}

	/**
	 * {@link regexRaw} with transformed applied {@link SettingOptions#pattern}
	 */
	get regexString() {
		return removeTags(this.#regexRaw, this._settings.pattern);
	}

	get flagsString() {
		return `${[...this.#flags].join("")}d`;
	}

	//#endregion

	constructor(
		regex: string,
		flags: RegexFlags[] | undefined,
		cls: string,
		hide: boolean | undefined,
		viewMode: ViewMode | undefined,
		settings: SettingOptions
	) {
		super();
		this._settings = settings;
		this.#regexRaw = regex;
		this.#flags = new Set(flags ?? ["g", "i"]);
		this.#class = cls;
		this.#hide = hide;
		this.#viewMode = viewMode ?? DEFAULT_VIEW_MODE;
	}

	//#region save/write
	serialize(): MarkRuleObj {
		return {
			regex: this.regexRaw,
			flags: [...this.#flags],
			class: this.#class,
			hide: this.#hide,
			viewMode: this.#viewMode,
		};
	}
	clone() {
		return MarkRule.from(this.serialize(), this._settings);
	}
	//#endregion

	//#region checks
	*getErrors(): Generator<MarkRuleErrorCode> {
		if (!this.regexRaw?.trim()) yield MarkRuleErrorCode.RegexMissing;
		else if (!valideRegexSyntax(this.regexString, this.flagsString)) yield MarkRuleErrorCode.RegexSyntaxError;
		else {
			if (regexMayMatchNewlineCharacter(this.regexRaw)) yield MarkRuleErrorCode.RegexMatchesNewline;

			if (this.hide && !this.hasPatterns()) yield MarkRuleErrorCode.RegexHideMissingPatterns;
		}
		if (!this.class?.trim()) yield MarkRuleErrorCode.ClassMissing;
	}
	shouldSkip(activeMode?: MarkdownViewModeType | "Live" | "Source" | undefined): boolean {
		return (
			!this.isValide() ||
			!validateAutoRules(this._settings.plugin.app, this._settings.propertyName, this.viewMode?.autoRules) ||
			incorrectActiveMode(this.viewMode)
		);

		function incorrectActiveMode(mode: ViewMode) {
			switch (activeMode) {
				case "preview":
					return !mode.reading;
				case "Live":
					return !mode.live;
				case "source":
				case "Source":
					return !mode.source;
				default:
					return false;
			}
		}

		/**
		 * @return If the AutoRules apply
		 */
		function validateAutoRules(app: App, propertyName: string, autoRules?: AutoRules[]): boolean {
			const filePath = getFile(app);
			if (!filePath || !autoRules || autoRules.length === 0) return true;
			for (const rule of autoRules) {
				if (rule.type === "path") {
					const regex = new RegExp(rule.value);
					if (regex.test(filePath.path)) {
						return !rule.exclude; // If exclude is true, return false
					}
				} else if (rule.type === "frontmatter") {
					const frontmatter = getFrontmatter(filePath, app);
					const value = frontmatter?.[propertyName];
					if (isNotExist(value, frontmatter) && rule.exclude) return true;
					if (value != null) {
						const regex = new RegExp(rule.value);
						const checked = checkValue(value, regex, rule);
						if (checked !== "none") return checked;
					}
				}
			}
			return false;
		}
		function isNotExist(value: unknown, frontmatter?: Record<string, unknown> | null) {
			return !frontmatter || value == null || (Array.isArray(value) && value.length === 0);
		}
		function checkValue(value: any, regex: RegExp, rule: AutoRules): boolean | "none" {
			if ((typeof value === "string" || typeof value === "number") && regex.test(value.toString()))
				return !rule.exclude;
			else if (Array.isArray(value) && value.length > 0) return value.some((v) => checkValue(v, regex, rule));
			else if (typeof value === "object" && value !== null)
				return Object.values(value).some((v) => checkValue(v, regex, rule));
			return "none";
		}
	}
	hasFlag(flag: RegexFlags) {
		return this.#flags.has(flag);
	}
	hasPatterns() {
		const pattern = this.patternSubRegex;
		return pattern.open || pattern.close;
	}
	hasNamedGroups() {
		return extractGroups(this.regexString).length > 0;
	}

	eq(other: this) {
		return other.regexRaw === this.regexRaw; //Sufficient: Will overwrite the same string elements. One will not show.
	}
	//#endregion

	public static from({ regex, flags, class: cls, hide, disable, viewMode }: MarkRuleObj, settings: SettingOptions) {
		if (disable && !viewMode) {
			console.warn(`Deprecated disable option found for ${cls}, removing it and adjust the viewMode option.`);
			viewMode = {
				reading: false,
				source: false,
				live: false,
			};
		}
		return new MarkRule(regex, flags, cls, hide, viewMode, settings);
	}
}

export class Pattern extends ModelObject<PatternObj, PatternErrorCode> {
	//#region properties
	open: RegexString;
	close: RegexString;
	get openRegex() {
		return new RegExp(this.open, "g");
	}
	get closeRegex() {
		return new RegExp(this.close, "g");
	}
	//#endregion
	constructor(open: string, close: string) {
		super();
		this.open = open ?? DEFAULT_PATTERN.open;
		this.close = close ?? DEFAULT_PATTERN.close;
	}
	*getErrors(): Generator<PatternErrorCode> {
		yield* this.getErrorsSingle("open");
		yield* this.getErrorsSingle("close");
	}
	*getErrorsSingle(which: "open" | "close") {
		const pattern = this[which];
		//verify if the _patternRegex is valid
		if (pattern.trim().length === 0) return PatternErrorCode.Empty;
		if (!valideRegexSyntax(pattern)) return PatternErrorCode.Invalid;
		if (which === "open" && !pattern.includes("open:")) yield PatternErrorCode.NotOpen;
		if (which === "close" && !pattern.includes("close:")) yield PatternErrorCode.NotClose;
		if (pattern === `${which}:(.*?)`) return PatternErrorCode.NeedChar;
		if (!pattern.match(/\(\.\*\??\)/)) yield PatternErrorCode.WithoutGroup;
	}
	serialize(): PatternObj {
		return {
			open: this.open,
			close: this.close,
		};
	}
	static from(obj: PatternObj) {
		return new Pattern(obj.open, obj.close);
	}
}

export class SettingOptions extends ModelObject<SettingOptionsObj, MarkRuleErrorCode | PatternErrorCode> {
	//#region properties
	readonly plugin: RegexMark;
	readonly #mark: MarkRule[];
	get mark() {
		return this.#mark;
	}
	#pattern: Pattern;
	get pattern() {
		return this.#pattern;
	}
	/**
	 * Property name to search in the frontmatter
	 */
	#propertyName: string;
	get propertyName() {
		return this.#propertyName;
	}
	set propertyName(val) {
		this.#propertyName = val;
		this._invokeOnChange();
	}

	get patternRegex() {
		return {
			open: this.#pattern.openRegex,
			close: this.#pattern.closeRegex,
		};
	}
	//#endregion

	constructor(
		plugin: RegexMark,
		mark: MarkRuleObj[] = [],
		pattern = DEFAULT_PATTERN,
		propertyName = DEFAULT_PROPERTYNAME
	) {
		super();
		this.#mark = mark.map((o) => MarkRule.from(o, this).addOnChange(() => this._invokeOnChange()));
		this.#pattern = Pattern.from(pattern).addOnChange(() => this._invokeOnChange());
		this.#propertyName = propertyName;
		this.plugin = plugin;
	}

	static from(settingsData: SettingOptionsObj | SettingOptionsObj0, plugin: RegexMark) {
		if (!settingsData) {
			return new SettingOptions(plugin);
		} else if (Array.isArray(settingsData)) {
			return new SettingOptions(plugin, settingsData);
		} else {
			const { mark, pattern, propertyName } = settingsData;
			return new SettingOptions(plugin, mark, pattern, propertyName);
		}
	}

	//#region modification
	/**
	 * @throws {Error}
	 */
	merge(settingsData: SettingOptionsObj | SettingOptionsObj0 | MarkRuleObj) {
		if (!settingsData) return;

		let settingsDataClean: SettingOptionsObj;
		if (Array.isArray(settingsData)) {
			settingsDataClean = {
				mark: settingsData,
				propertyName: "",
			};
		} else if (Object.hasOwn(settingsData, "regex")) {
			settingsDataClean = {
				mark: [settingsData as MarkRuleObj],
				propertyName: "",
			};
		} else {
			settingsDataClean = settingsData as SettingOptionsObj;
		}

		const marks = settingsDataClean.mark.map((m) => MarkRule.from(m, this));
		const pattern = settingsDataClean.pattern ? Pattern.from(settingsDataClean.pattern) : null;

		if (marks.some((m) => !m.isValide()) || (pattern && !pattern.isValide())) {
			throw new Error("Invalide Data", {
				cause: [
					["patternRegex", pattern ? [...pattern.getErrors()] : []],
					...marks.map((m) => [`class: ${m.class}, regx: ${m.regex}`, [...m.getErrors()]]),
				],
			});
		} else if (marks.some((newMark) => this.#mark.some((mark) => mark.eq(newMark)))) {
			throw new Error("Duplicate");
		}

		this.#addMark(...marks);
		if (pattern) this.#changePattern(pattern);

		this._invokeOnChange();
	}
	addNewMark() {
		const mark = MarkRule.from(
			{
				regex: "",
				class: "",
				hide: false,
			},
			this
		);
		this.#mark.push(mark);
		this._invokeOnChange();
		return mark;
	}
	addMark(...marks: MarkRule[]) {
		this.#addMark(...marks);
		this._invokeOnChange();
	}
	#addMark(...marks: MarkRule[]) {
		this.#mark.push(...marks);
		marks.forEach((m) => m.addOnChange(this._invokeOnChange));
	}
	removeMark(mark: MarkRule) {
		const index = this.#mark.indexOf(mark);
		this.#mark.splice(index, 1);
		mark.removeOnChange(this._invokeOnChange);
		this._invokeOnChange();
	}
	moveMarkIndex(mark: MarkRule, up: number) {
		const index = this.plugin.settings.#mark.indexOf(mark);
		if (index >= this.plugin.settings.#mark.length - 1 || index <= 0) return;
		this.plugin.settings.mark.splice(index + up, 0, this.plugin.settings.mark.splice(index, 1)[0]);
		this._invokeOnChange();
	}

	#changePattern(newPattern: Pattern) {
		const oldPattern = this.#pattern;
		const notValid = [];

		// Create a simplified _patternRegex without escaping characters
		const simplifiedPattern: PatternObj = {
			open: newPattern.open.replace("(.*?)", "$1").replaceAll(/\\/g, ""),
			close: newPattern.close.replace("(.*?)", "$1").replaceAll(/\\/g, ""),
		};

		// Update each regex with the new _patternRegex
		for (const data of this.mark) {
			data.regexRaw = data.regexRaw
				.replace(new RegExp(oldPattern.open), simplifiedPattern.open)
				.replace(new RegExp(oldPattern.close), simplifiedPattern.close);

			// Verify if the new regex is valid
			const isValid = data.isValide(); //await this.verifyRule(data, newPattern);
			if (!isValid) {
				data.viewMode = {
					reading: false,
					source: false,
					live: false,
				};
				notValid.push(data);
			}
		}

		this.#pattern = newPattern;
		return notValid;
	}
	/**
	 * Changes the open/close Pattern.
	 * Will modify the MarkRules to reflect the change
	 */
	changePattern(newPattern: Pattern) {
		const notValid = this.#changePattern(newPattern);
		this._invokeOnChange();
		return notValid;
	}
	//#endregion

	serialize(): SettingOptionsObj {
		return {
			mark: this.mark.map((o) => o.serialize()),
			pattern: this.#pattern.serialize(),
			propertyName: this.propertyName,
		};
	}

	//#region checks
	getDuplicateIndexes() {
		const duplicateIndex: {
			regex: string;
			index: number[];
		}[] = [];

		// Find duplicates
		for (const data of this.#mark) {
			const index = duplicateIndex.findIndex((d) => d.regex === data.regexRaw);

			if (index >= 0) {
				duplicateIndex[index].index.push(this.#mark.indexOf(data));
			} else {
				duplicateIndex.push({
					regex: data.regexRaw,
					index: [this.#mark.indexOf(data)],
				});
			}
		}

		return duplicateIndex.flatMap((d) => (d.index.length > 1 ? d.index : []));
	}
	*getErrors(): Generator<MarkRuleErrorCode | PatternErrorCode> {
		for (const serializableObj of [this.#pattern, ...this.mark] as ModelObject<
			any,
			MarkRuleErrorCode | PatternErrorCode
		>[]) {
			yield* serializableObj.getErrors();
		}
	}
	//#endregion
}
