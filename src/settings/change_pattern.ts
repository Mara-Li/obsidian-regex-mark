import { cloneDeep } from "lodash";
import { type App, Component, MarkdownRenderer, Notice, SettingPage, Setting, sanitizeHTMLToDom } from "obsidian";
import { dedent } from "ts-dedent";
import { DEFAULT_PATTERN, type PatternObj } from "../interface";
import { Pattern } from "../model";

export class PatternPage extends SettingPage {
	private result: PatternObj;
	private component: Component | undefined;

	constructor(
		private app: App,
		private currentPattern: PatternObj | undefined,
		private onSubmit: (result: PatternObj) => void | Promise<void>
	) {
		super();
		this.title = "Change open/close tags";
		this.containerEl.addClass("RegexMark");
		this.result = cloneDeep(currentPattern ?? DEFAULT_PATTERN);
	}

	exampleRegex(pattern: string) {
		return pattern.replaceAll(/\\/g, "");
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.component?.unload();
		this.component = new Component();
		this.component.load();

		const current = this.currentPattern ?? DEFAULT_PATTERN;
		const desc = dedent(`
			Allow to change the \`{{open:}}\` and \`{{close:}}\` tags.
			> [!WARNING]
			> Any character used in the tag will disable the character in it.
			> For example: \`[[open:]]]]\` can't work if open is set on \`[[open:]]\`.

			Your regex will be manually ported using the new settings. If an error is found during the conversion, the regex will be disabled in all view, and you will need to fix it manually.

			> [!NOTE]
			> The open/close needs to be registered in the regex format, so don't forget to escape the characters!
			> For example: \`[[open:(.*)]]\` needs to be saved as \`\\[\\[open:(.*)\\]\\]\`
			> Also, you can't use \`\\\` for the tag (reserved for escape only)!

			For the moment, based on your settings:
			- <u>Open</u>: \`${this.exampleRegex(current.open)}\`
			- <u>Close</u>: \`${this.exampleRegex(current.close)}\`.
		`);
		const docEl = containerEl.createDiv();
		MarkdownRenderer.render(this.app, desc, docEl, "", this.component);

		const inputs = new Map<"open" | "close", HTMLInputElement>();
		const addPatternSetting = (which: "open" | "close", name: string, desc: string) => {
			new Setting(containerEl)
				.setName(name)
				.setDesc(desc)
				.addText((text) => {
					inputs.set(which, text.inputEl);
					text.setValue(this.result[which]).onChange((value) => {
						this.result[which] = value;
						text.inputEl.removeClass("error");
					});
				});
		};
		addPatternSetting("open", "Open pattern", "Define the open pattern to be used");
		addPatternSetting("close", "Close pattern", "Define the close pattern to be used");

		new Setting(containerEl).addButton((button) => {
			button
				.setButtonText("Save")
				.setCta()
				.onClick(async () => {
					this.result.open = this.result.open.replace("(.*)", "(.*?)");
					this.result.close = this.result.close.replace("(.*)", "(.*?)");
					if (!this.verifyAllPattern(inputs)) return;
					await this.onSubmit(cloneDeep(this.result));
					this.currentPattern = cloneDeep(this.result);
					this.display();
				});
		});
	}

	verifyAllPattern(inputs: Map<"open" | "close", HTMLInputElement>): boolean {
		const errors: string[] = [];
		const pattern = new Pattern(this.result.open, this.result.close);
		for (const [which, el] of inputs) {
			const value = this.result[which];
			const codes = [...pattern.getErrorsSingle(which)];
			el.toggleClass("error", codes.length > 0);
			for (const code of codes) {
				errors.push(`<code>${value}</code>: <u>${code}</u>`);
			}
		}
		if (errors.length > 0) {
			const html = errors.map((d) => `<li class="error">${d}</li>`).join("");
			new Notice(sanitizeHTMLToDom(`<span class="RegexMark error">Errors found:<ul>${html}</ul></span>`));
			return false;
		}
		return true;
	}

	hide(): void {
		this.component?.unload();
		this.component = undefined;
	}
}
