import {
  DEFAULT_PATTERN, DEFAULT_VIEW_MODE,
  type Pattern,
  type RegexFlags,
  type MarkRuleObj,
  type SettingOptionsObj0,
  type SettingOptionsObj,
  type ViewMode, DEFAULT_SETTINGS, AutoRules
} from "./interface";
import {
  extractGroups,
  getFile,
  getFrontmatter, isInvalid, isValidRegex,
  regexMayMatchNewlineCharacter,
  removeTags
} from "./utils";
import {App, type MarkdownViewModeType} from "obsidian";
import RegexMark from "./main";

export enum MarkRuleErrors{
  "regex" = 1,
  "regex-missing" = 1 | 1<<1,
  "regex-syntax-error" = 1 | 1<<2,
  "regex-matches-newline" = 1 | 1<<3,
  "class" = 1<<8,
  "class-missing" = 1<<8 | 1<<1,
}

export class MarkRule {
  #settings: SettingOptions;
  /**
   * Regex to match the text
   */
  _regex: string;
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
   * Application view of the regex
   * Include the disable option
   */
  viewMode: ViewMode;

  /**
   * The Regex with applied flags
   */
  get regex(){
    return new RegExp(this.regexString, this.flagsString)
  }

  /**
   * The Regex String with transformed Pattern
   */
  get regexString(){
    return removeTags(this._regex, this.#settings.pattern);
  }

  get flagsString(){
    return this.flags ? `${this.flags.join("")}d` : "gid";
  }

  constructor(regex: string, flags: RegexFlags[]|undefined, cls: string, hide: boolean|undefined, viewMode: ViewMode|undefined, settings: SettingOptions) {
    this.#settings = settings;
    this._regex = regex;
    this.flags = flags;
    this.class = cls;
    this.hide = hide;
    this.viewMode = viewMode ?? DEFAULT_VIEW_MODE;
  }

  isValide(){
    return this.getErrors().next().done;
  }

  *getErrors(): Generator<MarkRuleErrors>{
    if(!this._regex?.trim())
      yield MarkRuleErrors["regex-missing"];
    else if((() => {
      try {
        new RegExp(this.regexString, this.flagsString);
        return false;
      } catch(_e) {
        return true;
      }
    })())
      yield MarkRuleErrors["regex-syntax-error"]
    else if(regexMayMatchNewlineCharacter(this._regex))
      yield MarkRuleErrors["regex-matches-newline"];

    if(!this.class?.trim())
      yield MarkRuleErrors["class-missing"];
  }

  //#region save/write
  serialize(): MarkRuleObj{
    return {
      regex: this._regex,
      flags: this.flags,
      class: this.class,
      hide: this.hide,
      viewMode: this.viewMode,
    }
  }
  //#endregion

  //#region execution
  shouldSkip(activeMode?: MarkdownViewModeType|undefined): boolean {
    return !this.isValide()||
           !validateAutoRules(this.#settings.plugin.app, this.#settings.propertyName, this.viewMode?.autoRules) ||
           incorrectActiveMode(this.viewMode);

    function incorrectActiveMode(mode:ViewMode){
      switch (activeMode) {
        case "preview":
          return !mode.reading;
        case "source":
          return !mode.live;
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
    function checkValue(value: unknown, regex: RegExp, rule: AutoRules): boolean | "none" {
      if ((typeof value === "string" || typeof value === "number") && regex.test(value.toString())) return !rule.exclude;
      else if (Array.isArray(value) && value.length > 0) return value.some((v) => checkValue(v, regex, rule));
      else if (typeof value === "object" && value != null)
        return Object.values(value).some((v) => checkValue(v, regex, rule));
      return "none";
    }
  }

  hasPatterns(){
    return new RegExp(this.#settings.pattern.open).test(this._regex) || new RegExp(this.#settings.pattern.close).test(this._regex)
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

export class SettingOptions{

  plugin: RegexMark;
  mark: MarkRule[];
  pattern: Pattern;
  /**
   * Property name to search in the frontmatter
   */
  propertyName: string;

  constructor(plugin: RegexMark, mark:MarkRuleObj[] = [], pattern = DEFAULT_PATTERN, propertyName = "regex_mark") {
    this.mark = mark.map(o => MarkRule.from(o, this));
    this.pattern = pattern;
    this.propertyName = propertyName;
    this.plugin = plugin;
  }

  static from(plugin: RegexMark, settingsData: SettingOptionsObj|SettingOptionsObj0){

    if (Array.isArray(settingsData)) {
      return new SettingOptions(
        plugin,
        settingsData,
        DEFAULT_SETTINGS.pattern,
        "regex_mark",
      );
    } else {
      const {mark, pattern, propertyName} = settingsData;
      return new SettingOptions(plugin, mark, pattern, propertyName);
    }
  }

  addNewMark(){
    const mark = MarkRule.from({
      regex: "",
      class: "",
      hide: false,
    }, this)
    this.mark.push(mark);
    return mark;
  }

  serialize(): SettingOptionsObj{
    return {
      mark: this.mark.map(o => o.serialize()),
      pattern: this.pattern,
      propertyName: this.propertyName,
    }
  }
}
