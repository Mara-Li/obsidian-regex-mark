import { type App, MarkdownView, sanitizeHTMLToDom } from "obsidian";

import type { Mark, Pattern } from "./interface";
import { isValidRegex, removeTags } from "./utils";

export function MarkdownProcessor(data: Mark, element: HTMLElement, app: App, pattern?: Pattern) {
	const paragraph = element.findAll("p, li, h1, h2, h3, h4, h5, h6, td, .callout-title-inner, th, code");
	paragraph.push(...element.findAllSelf(".table-cell-wrapper"));
	const activeMode = app.workspace.getActiveViewOfType(MarkdownView)?.getMode() === "source";
	for (const p of paragraph) {
		let ignore = true;
		for (const d of data) {
			if (
				!d.regex ||
				!d.class ||
				d.regex === "" ||
				d.class === "" ||
				!isValidRegex(d.regex, true, pattern) ||
				d.viewMode?.reading === false
			)
				continue;
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
			textNodes.push(treeWalker.currentNode);
		}
		for (const node of textNodes) {
			let text = node.textContent;
			if (text) {
				for (const d of data) {
					if (node.parentNode?.nodeName === "CODE" && d.viewMode?.codeBlock === false) continue;
					const enabled = activeMode ? d.viewMode?.live : d.viewMode?.reading;
					if (!d.regex || !d.class || d.regex === "" || d.class === "" || enabled === false) continue;
					const regex = new RegExp(removeTags(d.regex, pattern), d.flags?.join("") ?? "gi");
					if (d.hide) {
						const group = removeTags(d.regex, pattern).match(/\((.*?)\)/);
						const dataText = regex.exec(text);
						if (!group || !dataText || !dataText?.[1]) continue;
						text = text.replace(regex, `<span class="${d.class}" data-contents="$1">$1</span>`);
					} else text = text.replace(regex, `<span class="${d.class}" data-contents="$&">$&</span>`);
				}
				const dom = sanitizeHTMLToDom(text);
				if (node.parentNode) node.parentNode.replaceChild(dom, node);
			}
		}
	}
}
