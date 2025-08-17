/** Reading mode processor .*/
import { type App, MarkdownView, sanitizeHTMLToDom } from "obsidian";

import type { PatternObj } from "./interface";
import { applyRuleClasses } from "./utils";
import { MarkRule } from "./model";

export function MarkdownProcessor(data: MarkRule[], element: HTMLElement, app: App) {
	const paragraph = element.findAll("p, li, h1, h2, h3, h4, h5, h6, td, .callout-title-inner, th, code");
	paragraph.push(...element.findAllSelf(".table-cell-wrapper"));

	const activeMode = app.workspace.getActiveViewOfType(MarkdownView)?.getMode();

	//Filter Rules that don't apply here
	data = data.filter((rule) => !rule.shouldSkip(activeMode));

	for (const p of paragraph) {
		//Does Any Rule match?
		if (data.every((markRule) => !markRule.regex.test(p.textContent || ""))) continue;

		const treeWalker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
		const textNodes: Node[] = [];
		while (treeWalker.nextNode()) {
			const parentSpan = (treeWalker.currentNode as Node).parentElement;
			if (
				parentSpan?.hasAttribute("data-processed") ||
				parentSpan?.hasAttribute("data-group") ||
				parentSpan?.closest("[data-processed]")
			) {
				continue;
			}
			textNodes.push(treeWalker.currentNode);
		}

		for (let i = 0; i < textNodes.length; i++) {
			const node = textNodes[i];
			let text = node.textContent;

			if (text) {
				let hasChanges = false;
				let finalElement: DocumentFragment | undefined;

				for (const markRule of data) {
					if (node.parentNode?.nodeName === "CODE" && markRule.viewMode?.codeBlock === false) continue;

					const regex: RegExp = markRule.regex;
					const dataMatch = regex.exec(text);

					if (dataMatch) {
						if (dataMatch[0].includes("\n")) {
							console.warn(
								`Regex Mark with regex: ${regex}; class: ${markRule.class} matched with newline. No class applied`
							);
							continue;
						}

						finalElement = applyRuleClasses(text, markRule, dataMatch);

						if (markRule.hasFlag("g")) {
							textNodes.push(
								// Attach Unprocessed Text Nodes
								...[...finalElement.childNodes].filter((e) => e.nodeType === Node.TEXT_NODE)
							);
						}

						hasChanges = true;
						break;
					}
				}

				if (hasChanges && node.parentNode) {
					if (finalElement) {
						node.parentNode.replaceChild(finalElement, node);
					} else {
						const dom = sanitizeHTMLToDom(text);
						node.parentNode.replaceChild(dom, node);
					}
				}
			}
		}
	}
}
