import {
  DEFAULT_PATTERN, DEFAULT_VIEW_MODE,
  type Pattern,
  type RegexFlags,
  type MarkRuleObj,
  type SettingOptionsObj0,
  type SettingOptionsObj,
  type ViewMode, DEFAULT_SETTINGS
} from "./interface";
import {includeFromSettings, isValidRegex, removeTags} from "./utils";
import {App} from "obsidian";


export class MarkRule {
  /**
   * Regex to match the text
   */
  _regex: string;
  _pattern: Pattern;
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
  viewMode?: ViewMode;

  constructor(regex: string, flags: RegexFlags[]|undefined, cls: string, hide: boolean|undefined, viewMode: ViewMode|undefined, pattern: Pattern) {
    this._regex = regex;
    this.flags = flags;
    this.class = cls;
    this.hide = hide;
    this.viewMode = viewMode ?? DEFAULT_VIEW_MODE;
    this._pattern = pattern;
  }

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
    return removeTags(this._regex, this._pattern);
  }

  get flagsString(){
    return this.flags ? `${this.flags.join("")}d` : "gid";
  }

  isValide(warn = true){
    return isValidRegex(this._regex,warn, this._pattern);
  }

  serialize(): MarkRuleObj{
    return {
      regex: this._regex,
      flags: this.flags,
      class: this.class,
      hide: this.hide,
      viewMode: this.viewMode,
    }
  }

  shouldSkip(app: App, propertyName: string): boolean {
    return (
      !this._regex ||
      !this.class ||
      this._regex === "" ||
      this.class === "" ||
      !isValidRegex(this._regex, true, this._pattern) ||
      !includeFromSettings(app, propertyName, this.viewMode?.autoRules)
    );
  }

  static from({regex, flags, class:cls, hide, disable, viewMode}: MarkRuleObj, pattern: Pattern){
    const option = new MarkRule(regex, flags, cls, hide, viewMode, pattern);
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

  mark: MarkRule[];
  pattern: Pattern;
  /**
   * Property name to search in the frontmatter
   */
  propertyName: string;

  constructor(mark:MarkRuleObj[] = [], pattern = DEFAULT_PATTERN, propertyName = "regex_mark") {
    this.mark = mark.map(o => MarkRule.from(o, pattern));
    this.pattern = pattern;
    this.propertyName = propertyName;
  }

  static from(settingsData: SettingOptionsObj|SettingOptionsObj0){

    if (Array.isArray(settingsData)) {
      return new SettingOptions(
        settingsData,
        DEFAULT_SETTINGS.pattern,
        "regex_mark"
      );
    } else {
      const {mark, pattern, propertyName} = settingsData;
      return new SettingOptions(mark, pattern, propertyName);
    }
  }

  addNewMark(){
    const mark = MarkRule.from({
      regex: "",
      class: "",
      hide: false,
    }, this.pattern)
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
