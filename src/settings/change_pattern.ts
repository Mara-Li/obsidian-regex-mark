import { type App, Modal, Notice, Setting, sanitizeHTMLToDom } from "obsidian";
import { dedent } from "ts-dedent";
import { DEFAULT_PATTERN, type Pattern } from "../interface";

enum ErrorCode {
	NotOpen = "Pattern doesn't contain 'open:'",
	NotClose = "Pattern doesn't contain 'close:'",
	Empty = "Pattern is empty",
	Invalid = "Pattern is invalid",
	WithoutGroup = "Pattern doesn't contain a group",
	NeedChar = "Pattern need to contain a character for enclosing",
}

export class RemarkPatternTab extends Modal {
	result: Pattern;
	oldPattern: Pattern | undefined;
	onSubmit: (result: Pattern) => void;

	constructor(app: App, oldPattern: Pattern | undefined, onSubmit: (result: Pattern) => void) {
		super(app);
		this.onSubmit = onSubmit;
		this.oldPattern = oldPattern;
	}

	exampleRegex(pattern: string) {
		return pattern.replaceAll(/\\/g, "");
	}

	onOpen(): void {
		const { contentEl } = this;
		this.contentEl.addClasses(["RegexMark", "pattern-change"]);
		this.result = this.oldPattern ?? DEFAULT_PATTERN;

		new Setting(contentEl).setHeading().setName("Change open/close pattern");

		const desc = dedent(`
			<p dir="auto">Allow to change the <code>{{open:}}</code> and <code>{{close:}}</code> pattern.</p>
			<div data-callout-metadata="" data-callout-fold="" data-callout="warning" class="callout">
				<div class="callout-title" dir="auto">
					<div class="callout-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-alert-triangle">
							<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
							<path d="M12 9v4"></path>
							<path d="M12 17h.01"></path>
						</svg>
					</div>
					<div class="callout-title-inner">Warning</div>
				</div>
				<div class="callout-content">
					<p dir="auto">Any character used in the pattern will disable the character in it.<br>
					For example: <code>[[open:]]]]</code> can't work if open is set on <code>[[open:]]</code>.</p>
				</div>
			</div>
			<p>Your regex will be manually ported using the new settings. If an error is found during the conversion, the regex will be disabled in all view and you will need to fix it manually.</p>
			<div data-callout-metadata="" data-callout-fold="" data-callout="note" class="callout">
				<div class="callout-title" dir="auto">
					<div class="callout-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-pencil">
							<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
							<path d="m15 5 4 4"></path>
						</svg>
					</div>
					<div class="callout-title-inner">Note</div>
				</div>
				<div class="callout-content">
					<p dir="auto">The open/close needs to be registered in the regex format, so don't forget to escape the characters!<br>
					For example: <code>[[open:(.*)]]</code> needs to be saved as <code>\\[\\[open:(.*)\\]\\]</code><br>Also, you can't use <code>\\</code> for the pattern (reserved for escape only)!</p>
				</div>
			</div>
			<p dir="auto">For the moment, based on your settings:</p>
			<ul class="has-list-bullet">
				<li data-line="0" dir="auto"><u>Open</u>: <code>${this.exampleRegex(this.oldPattern?.open ?? DEFAULT_PATTERN.open)}</code></li>
				<li data-line="1" dir="auto"><u>Close</u>: <code>${this.exampleRegex(this.oldPattern?.close ?? DEFAULT_PATTERN.close)}</code></li>
			</ul>
		`);
		contentEl.appendChild(sanitizeHTMLToDom(desc));

		new Setting(contentEl)
			.setName("Pattern")
			.setDesc("Define the pattern to be used")
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
			.setName("Close pattern")
			.setDesc("Define the close pattern to be used")
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

	verifyRegexPattern(pattern: string, which: "open" | "close"): ErrorCode | true {
		//verify if the pattern is valid
		if (pattern.trim().length === 0) return ErrorCode.Empty;
		if (which === "open" && !pattern.includes("open:")) return ErrorCode.NotOpen;
		if (which === "close" && !pattern.includes("close:")) return ErrorCode.NotClose;
		if (pattern === `${which}:(.*?)`) return ErrorCode.NeedChar;
		if (!pattern.match(/\(\.\*\??\)/)) return ErrorCode.WithoutGroup;
		try {
			new RegExp(pattern);
			return true;
		} catch (_e) {
			return ErrorCode.Invalid;
		}
	}

	verifyAllPattern(): boolean {
		const errors: string[] = [];
		this.contentEl.querySelectorAll("input.pattern").forEach((el) => {
			const which = el.getAttribute("data-type") as "open" | "close";
			const value = el.getAttribute("data-value") ?? "";
			const result = this.verifyRegexPattern(value, which);
			if (result !== true) {
				el.addClass("error");
				errors.push(`<code>${value}</code>: <u>${result}</u>`);
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
