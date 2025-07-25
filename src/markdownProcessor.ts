/** Reading mode processor .*/
import { type App, MarkdownView, sanitizeHTMLToDom } from "obsidian";

import type { Mark, Pattern } from "./interface";
import { addGroupText, extractGroups, matchGroups, removeTags, shouldSkip } from "./utils";

export function MarkdownProcessor(data: Mark, element: HTMLElement, app: App, propertyName: string, pattern?: Pattern) {
	const paragraph = element.findAll("p, li, h1, h2, h3, h4, h5, h6, td, .callout-title-inner, th, code");
	paragraph.push(...element.findAllSelf(".table-cell-wrapper"));
	const activeMode = app.workspace.getActiveViewOfType(MarkdownView)?.getMode() === "source";
	for (const p of paragraph) {
		let ignore = true;
		for (const d of data) {
			if (d.viewMode?.reading === false || shouldSkip(d, app, propertyName, pattern)) continue;
			const regex = new RegExp(removeTags(d.regex, pattern), d.flags?.join("") ?? "gi");
			if (regex.test(p.textContent || "")) {
				ignore = false;
				break;
			}
		}
		if (ignore) continue;

		const treeWalker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
		const textNodes = [];
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
		for (const node of textNodes) {
			let text = node.textContent;
			if (text) {
				let hasChanges = false;
				let finalElement: DocumentFragment | undefined;

				for (const d of data) {
					if (!d.viewMode) d.viewMode = { reading: true, source: true, live: true, codeBlock: true };
					if (node.parentNode?.nodeName === "CODE" && d.viewMode?.codeBlock === false) continue;

					const enabled = activeMode ? d.viewMode?.live : d.viewMode?.reading;
					if (!d.regex || !d.class || d.regex === "" || d.class === "" || !enabled) continue;

					const flags = d.flags ? [...d.flags, "d"].join("") : "gid";

					const hasPatterns = pattern && d.regex.includes("{{open:") && d.regex.includes("{{close:");
					const hasNamedGroups = extractGroups(d.regex).length > 0;

					let regex: RegExp;
					if (hasPatterns && hasNamedGroups && d.hide) {
						let regexStr = d.regex;
						const openMatch = regexStr.match(/{{open:(.*?)}}/);
						const closeMatch = regexStr.match(/{{close:(.*?)}}/);
						if (openMatch && closeMatch) {
							regexStr = regexStr.replace(/{{open:(.*?)}}/, openMatch[1]);
							regexStr = regexStr.replace(/{{close:(.*?)}}/, closeMatch[1]);
						}
						regex = new RegExp(regexStr, flags);
					} else {
						regex = new RegExp(removeTags(d.regex, pattern), flags);
					}

					if (d.hide) {
						const group = removeTags(d.regex, pattern)
							.match(/\((.*?)\)/)
							?.filter((x) => x != null);
						const dataText = regex.exec(text);
						if (!group || !dataText || /* $1 defines visible content */ dataText.length < 2) continue;
						const subgroup = matchGroups(regex.source, text);
						if (!subgroup && !(hasPatterns && hasNamedGroups)) {
							text = text.replace(regex, `<span class="${d.class}" data-contents="$1">$1</span>`);
							hasChanges = true;
						} else {
							finalElement = addGroupText(text, d, dataText, pattern);
							hasChanges = true;
							break;
						}
					} else {
						const dataText = regex.exec(text);
						if (!dataText) continue;
						const subgroup = matchGroups(regex.source, text);
						if (!subgroup) {
							text = text.replace(regex, `<span class="${d.class}" data-contents="$&">$&</span>`);
							hasChanges = true;
						} else {
							finalElement = addGroupText(text, d, dataText, pattern);
							hasChanges = true;
							break;
						}
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
