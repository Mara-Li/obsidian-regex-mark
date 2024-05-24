import { sanitizeHTMLToDom } from "obsidian";

import type { SettingOption } from "./setting";
import { isValidRegex, removeTags } from "./utils";

export function MarkdownProcesser(data: SettingOption[], element: HTMLElement) {
	const paragraph = element.findAll("p, li, h1, h2, h3, h4, h5, h6, td, .callout-title-inner");
	paragraph.push(...element.findAllSelf(".table-cell-wrapper"));

	for (const p of paragraph) {
		let ignore = true;
		for (const d of data) {
			if (!d.regex || !d.class || d.regex === "" || d.class === "" || !isValidRegex(d.regex))
				continue;
			const regex = new RegExp(removeTags(d.regex));
			if (regex.test(p.textContent || "")) {
				ignore = false;
				break;
			}
		}
		if (ignore)
			continue;

		const treeWalker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
		const textNodes = [];
		while (treeWalker.nextNode()) {
			textNodes.push(treeWalker.currentNode);
		}
		for (const node of textNodes) {
			let text = node.textContent;
			if (text) {
				for (const d of data) {
					if (!d.regex || !d.class || d.regex === "" || d.class === "") continue;
					const regex = new RegExp(removeTags(d.regex));
					if (d.hide) {
						const group = removeTags(d.regex).match(/\((.*?)\)/);
						const dataText = regex.exec(text);
						if (!group || !dataText || !dataText?.[1]) continue;
						text = text.replace(regex, `<span class="${d.class}" data-contents="$1">$1</span>`);
					}
					else text = text.replace(regex, `<span class="${d.class}" data-contents="$&">$&</span>`);
				}
				const dom = sanitizeHTMLToDom(text);
				if (node.parentNode) {
					node.parentNode.replaceChild(dom, node);
				}
			}
		}
	}
}