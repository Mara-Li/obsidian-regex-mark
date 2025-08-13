import {
  DEFAULT_PATTERN, DEFAULT_VIEW_MODE,
  type PatternObj,
  type RegexFlags,
  type MarkRuleObj,
  type SettingOptionsObj0,
  type SettingOptionsObj,
  type ViewMode, AutoRules
} from "./interface";
import {
  extractGroups,
  getFile,
  getFrontmatter,
  regexMayMatchNewlineCharacter,
  removeTags
} from "./utils";
import {App, type MarkdownViewModeType, Notice, sanitizeHTMLToDom} from "obsidian";
import RegexMark from "./main";

export enum MarkRuleErrorCode{
  RegexMissing = "Regex is missing",
  RegexSyntaxError = "Regex has a syntax rrror",
  RegexMatchesNewline = "Regex can match newlines (\\n). This can happen in [^] groups or with \\s",
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

abstract class ModelObject<SerializedObj,ErrorCode>{
  isValide(){
    return this.getErrors().next().done;
  }

  /**
   * Get Errors produced by this Element or its children as a (finite) Generator
   * @example [...obj.getErrors()] for full list
   */
  abstract getErrors(): Generator<ErrorCode>;
  abstract serialize(): SerializedObj;
}

export class MarkRule extends ModelObject<MarkRuleObj,MarkRuleErrorCode>{
  _settings: SettingOptions;
  /**
   * Regex to match the text
   */
  _regex: string;
  /**
   * Regex _flags
   * @default ['g', 'i']
   */
  _flags: RegexFlags[];
  /**
   * The associated css class
   */
  class: string;
  /**
   * If the regex have a group {{open}} and {{close}} and the open/close should be hidden
   */
  hide?: boolean;
  /**
   * Application view of the regex
   * Include the disable option
   */
  viewMode: ViewMode;

  /**
   * The Regex with applied _flags
   */
  get regex(){
    return new RegExp(this.regexString, this.flagsString)
  }

  get patternSubRegex(){
    const
      pattern = this._settings.pattern,
      openMatchString = pattern.open.exec(this._regex)?.[1],
      closeMatchString = pattern.close.exec(this._regex)?.[1];

    return {
      open: openMatchString ? new RegExp(`^${openMatchString}`) : null,
      close: closeMatchString ? new RegExp(`${closeMatchString}$`) : null,
    };
  }

  /**
   * The Regex String with transformed PatternObj
   */
  get regexString(){
    return removeTags(this._regex, this._settings._pattern);
  }

  get flagsString(){
    return `${this._flags.join("")}d`;
  }

  constructor(regex: string, flags: RegexFlags[]|undefined, cls: string, hide: boolean|undefined, viewMode: ViewMode|undefined, settings: SettingOptions) {
    super();
    this._settings = settings;
    this._regex = regex;
    this._flags = flags ?? ["g", "i"];
    this.class = cls;
    this.hide = hide;
    this.viewMode = viewMode ?? DEFAULT_VIEW_MODE;
  }

  isValide(){
    return this.getErrors().next().done;
  }

  *getErrors(): Generator<MarkRuleErrorCode>{
    if(!this._regex?.trim())
      yield MarkRuleErrorCode.RegexMissing;
    else if( /** test new RegExp */ (() => {try {new RegExp(this.regexString, this.flagsString); return false;} catch(_e) {return true;}})())
      yield MarkRuleErrorCode.RegexSyntaxError
    else {

      if (regexMayMatchNewlineCharacter(this._regex))
        yield MarkRuleErrorCode.RegexMatchesNewline;

      if (this.hide && !this.hasPatterns())
        yield MarkRuleErrorCode.RegexHideMissingPatterns;

    }

    if(!this.class?.trim())
      yield MarkRuleErrorCode.ClassMissing;
  }

  //#region save/write
  serialize(): MarkRuleObj{
    return {
      regex: this._regex,
      flags: this._flags,
      class: this.class,
      hide: this.hide,
      viewMode: this.viewMode,
    }
  }
  clone(){
    return MarkRule.from(this.serialize(), this._settings);
  }
  //#endregion

  //#region execution
  shouldSkip(activeMode?: MarkdownViewModeType|"Live"|"Source"|undefined): boolean {
    return !this.isValide()||
           !validateAutoRules(this._settings.plugin.app, this._settings.propertyName, this.viewMode?.autoRules) ||
           incorrectActiveMode(this.viewMode);

    function incorrectActiveMode(mode:ViewMode){
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
      if ((typeof value === "string" || typeof value === "number") && regex.test(value.toString())) return !rule.exclude;
      else if (Array.isArray(value) && value.length > 0) return value.some((v) => checkValue(v, regex, rule));
      else if (typeof value === "object" && value !== null)
        return Object.values(value).some((v) => checkValue(v, regex, rule));
      return "none";
    }
  }
  hasFlag(flag:RegexFlags){
    return this._flags.includes(flag);
  }
  hasPatterns(){
    const pattern = this.patternSubRegex;
    return pattern.open || pattern.close;
  }
  hasNamedGroups(){
    return extractGroups(this.regexString).length > 0
  }
  //#endregion

  static from({regex, flags, class:cls, hide, disable, viewMode}: MarkRuleObj, settings: SettingOptions){
    const option = new MarkRule(regex, flags, cls, hide, viewMode, settings);
    if(disable) {
      console.warn(`Deprecated disable option found for ${cls}, removing it and adjust the viewMode option.`);
      option.viewMode = {
        reading: false,
        source: false,
        live: false,
      };
    }
    return option;
  }

}

export class Pattern extends ModelObject<PatternObj,PatternErrorCode>{
  open:string;
  close:string;
  constructor(open:string, close:string) {
    super();
    this.open = open ?? DEFAULT_PATTERN.open;
    this.close = close ?? DEFAULT_PATTERN.close;
  }
  *getErrors(): Generator<PatternErrorCode>{
    yield* this.getErrorsSingle("open");
    yield* this.getErrorsSingle("close");
  }
  *getErrorsSingle(which: "open"|"close"){
    const pattern = this[which];
    //verify if the _pattern is valid
    if (pattern.trim().length === 0) return PatternErrorCode.Empty;
    if (which === "open" && !pattern.includes("open:")) yield PatternErrorCode.NotOpen;
    if (which === "close" && !pattern.includes("close:")) yield PatternErrorCode.NotClose;
    if (pattern === `${which}:(.*?)`) return PatternErrorCode.NeedChar;
    if (!pattern.match(/\(\.\*\??\)/)) yield PatternErrorCode.WithoutGroup;
    try {
      new RegExp(pattern);
      return;
    } catch (_e) {
      yield PatternErrorCode.Invalid;
    }
  }
  serialize():PatternObj{
    return {
      open: this.open,
      close: this.close
    }
  }
  static from(obj: PatternObj){
    return new Pattern(obj.open,obj.close)
  }
}

export class SettingOptions extends ModelObject<SettingOptionsObj,MarkRuleErrorCode|PatternErrorCode>{

  plugin: RegexMark;
  #mark: MarkRule[];
  _pattern: Pattern;
  /**
   * Property name to search in the frontmatter
   */
  propertyName: string;

  get pattern(){
    return {
      open: new RegExp(this._pattern.open, "g"),
      close: new RegExp(this._pattern.close, "g")
    }
  }
  get mark(){
    return this.#mark;
  }

  constructor(plugin: RegexMark, mark:MarkRuleObj[] = [], pattern = DEFAULT_PATTERN, propertyName = "regex_mark") {
    super();
    this.#mark = mark.map(o => MarkRule.from(o, this));
    this._pattern = Pattern.from(pattern);
    this.propertyName = propertyName;
    this.plugin = plugin;
  }

  static from(plugin: RegexMark, settingsData: SettingOptionsObj|SettingOptionsObj0){

    if (Array.isArray(settingsData)) {
      return new SettingOptions(
        plugin,
        settingsData,
        DEFAULT_PATTERN,
        "regex_mark",
      );
    } else {
      const {mark, pattern, propertyName} = settingsData;
      return new SettingOptions(plugin, mark, pattern, propertyName);
    }
  }

  //#region settings modification
  addNewMark(){
    const mark = MarkRule.from({
      regex: "",
      class: "",
      hide: false,
    }, this)
    this.mark.push(mark);
    return mark;
  }
  removeMark(mark:MarkRule){
    const index = this.#mark.indexOf(mark);
    this.#mark.splice(index,1);
  }

  changePattern(newPattern: Pattern){
    const oldPattern = this._pattern;
    const notValid = [];

    // Create a simplified _pattern without escaping characters
    const simplifiedPattern: PatternObj = {
      open:  newPattern.open.replace("(.*?)", "$1").replaceAll(/\\/g, ""),
      close: newPattern.close.replace("(.*?)", "$1").replaceAll(/\\/g, ""),
    };

    // Update each regex with the new _pattern
    for (const data of this.mark) {
      data._regex = data._regex
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

    this._pattern = newPattern;
    return notValid;
  }
  //#endregion

  serialize(): SettingOptionsObj{
    return {
      mark: this.mark.map(o => o.serialize()),
      pattern: this._pattern.serialize(),
      propertyName: this.propertyName,
    }
  }

  *getErrors(): Generator<MarkRuleErrorCode | PatternErrorCode> {
    for (const serializableObj of [this._pattern,...this.mark] as ModelObject<any, MarkRuleErrorCode | PatternErrorCode>[]) {
      yield* serializableObj.getErrors();
    }
  }
}

