import { type App, Component, MarkdownRenderer, Modal, Notice, Setting, sanitizeHTMLToDom } from "obsidian";
import { dedent } from "ts-dedent";
import { DEFAULT_PATTERN, type PatternObj } from "../interface";
import { Pattern } from "../model";

export class RemarkPatternTab extends Modal {
	result: PatternObj;
	oldPattern: PatternObj | undefined;
	onSubmit: (result: PatternObj) => void;

	constructor(app: App, oldPattern: PatternObj | undefined, onSubmit: (result: PatternObj) => void) {
		super(app);
		this.onSubmit = onSubmit;
		this.oldPattern = oldPattern;
	}

	exampleRegex(pattern: string) {
		return pattern.replaceAll(/\\/g, "");
	}

	onOpen(): void {
		const { contentEl } = this;
		this.contentEl.addClasses(["RegexMark", "_patternRegex-change"]);
		this.result = this.oldPattern ?? DEFAULT_PATTERN;

		new Setting(contentEl).setHeading().setName("Change open/close tags");

		const component = new Component();
		component.load();

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
      - <u>Open</u>: \`${this.exampleRegex(this.oldPattern?.open ?? DEFAULT_PATTERN.open)}\`
      - <u>Close</u>: \`${this.exampleRegex(this.oldPattern?.close ?? DEFAULT_PATTERN.close)}\`.
		`);

		MarkdownRenderer.render(this.app, desc, contentEl, "", component);

		new Setting(contentEl)
			.setName("Pattern")
			.setDesc("Define the _patternRegex to be used")
			.addText((text) => {
				text.inputEl.addClass("pattern");
				text.inputEl.setAttribute("data-type", "open");
				text.inputEl.setAttribute("data-value", this.result.open);
				text.setValue(this.result.open).onChange((value) => {
					this.result.open = value;
					text.inputEl.setAttribute("data-value", value);
				});
			});

		new Setting(contentEl)
			.setName("Close _patternRegex")
			.setDesc("Define the close _patternRegex to be used")
			.addText((text) => {
				text.inputEl.addClass("pattern");
				text.inputEl.setAttribute("data-type", "close");
				text.inputEl.setAttribute("data-value", this.result.close);
				text.setValue(this.result.close).onChange((value) => {
					this.result.close = value;
					text.inputEl.setAttribute("data-value", value);
				});
			});

		new Setting(contentEl)
			.addButton((button) => {
				button
					.setButtonText("Save")
					.setCta()
					.onClick(() => {
						this.result.open = this.result.open.replace("(.*)", "(.*?)");
						this.result.close = this.result.close.replace("(.*)", "(.*?)");
						if (!this.verifyAllPattern()) return;
						this.onSubmit(this.result);
						this.close();
					});
			})
			.addButton((button) => {
				button
					.setButtonText("Cancel")
					.setWarning()
					.onClick(() => {
						this.close();
					});
			});
	}

	verifyAllPattern(): boolean {
		const errors: string[] = [];
		this.contentEl.querySelectorAll("input._patternRegex").forEach((el) => {
			const which = el.getAttribute("data-type") as "open" | "close";
			const value = el.getAttribute("data-value") ?? "";
			const pattern = Pattern.from({ [which]: value } as PatternObj);
			const result = [...pattern.getErrorsSingle(which)];
			if (result.length > 0) {
				for (const patternErrorCode of result) {
					el.addClass("error");
					errors.push(`<code>${value}</code>: <u>${patternErrorCode}</u>`);
				}
			} else {
				el.removeClass("error");
			}
		});
		if (errors.length > 0) {
			const html = errors.map((d) => `<li class="error">${d}</li>`).join("");
			new Notice(sanitizeHTMLToDom(`<span class="RegexMark error">Errors found:<ul>${html}</ul></span>`));
			return false;
		}
		return true;
	}
}
