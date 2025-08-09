import { cloneDeep } from "lodash";
import { type App, sanitizeHTMLToDom, type TFile } from "obsidian";
import type { Pattern } from "./interface";
import {MarkRule} from "./model";
import {DEFAULT_PATTERN} from "./interface";

export function removeTags(regex: string, pattern: Pattern = DEFAULT_PATTERN) {
  if(!regex) return regex;
  const patternReg = new RegExp(`^(?:${pattern.open})?(.*?)(?:${pattern.close})?$`);
  return regex.replace(patternReg, "$1($2)$3");
}

export const isInvalid = (regex: string) => {
	return !!(regex.match(/(.*)\[\^(.*)\](.*)/) && !regex.match(/(.*)\[\^(.*)\\n(.*)\](.*)/));
};
export function regexMayMatchNewlineCharacter(regex:string){
  const negativeReg = /\[\^.*?[^\\]]|\[\^]/g;
  const [,...negativeMatches] = regex.match(negativeReg) || [""]
  if(negativeMatches.some(m => !m.includes("\n"))) return true;

  return !!regex.replace(negativeReg, "").match(/\\(?:n|s|u000A|u000D|u2028|u2029)/)
}

export function isValidRegex(regex: string, warn = true, pattern?: Pattern) {
	if (isInvalid(regex)) {
    if (warn) console.warn(`Invalid regex: ${regex}`);
		return false;
	}
	try {
		new RegExp(removeTags(regex, pattern), "gmu");
		return true;
	} catch (_e) {
		if (warn) console.warn(`Invalid regex: ${regex}`);
		return false;
	}
}

export function hasToHide(regex: string, pattern?: Pattern) {
	return removeTags(regex, pattern).match(/\((.*?)\)/) && hasPattern(regex, pattern);
}

export function hasPattern(regex: string, pattern?: Pattern) {
	if (!pattern) return false;
	const open = new RegExp(pattern.open);
	const close = new RegExp(pattern.close);
	return open.test(regex) || close.test(regex);
}

export function extractGroups(regex: string): string[] {
	const groupPattern = /\(\?<([a-zA-Z_][a-zA-Z0-9_]*)>/g;
	const groups: string[] = [];

	let match;
	//biome-ignore lint/suspicious/noAssignInExpressions: let match be reused
	while ((match = groupPattern.exec(regex)) !== null) groups.push(match[1]);
	return groups;
}

export function getFile(app: App): TFile | null {
	const file = app.workspace.getActiveFile();
	return file ? file : null;
}

export function getFrontmatter(file: TFile | null, app: App): Record<string, unknown> | null {
	if (!file) return null;

	const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
	return frontmatter ? cloneDeep(frontmatter) : null;
}

export function addGroupText(
	text: string,
	d: MarkRule,
	match: RegExpExecArray,
	pattern?: Pattern
): DocumentFragment {
	const parent = new DocumentFragment();
	const mainSpan = document.createElement("span");
	mainSpan.setAttribute("data-group", "false");
	mainSpan.setAttribute("class", d.class);
	mainSpan.setAttribute("data-contents", match[0]);
	mainSpan.setAttribute("data-processed", "true");

	const preNode = sanitizeHTMLToDom(text.substring(0, match.index));
	const afterNode = sanitizeHTMLToDom(text.substring(match.index + match[0].length));

	parent.append(preNode, mainSpan, afterNode);

	let processedText = match[0];
	let hideMask = Array.from({ length: processedText.length }).fill(true);

	if (processedText) {
		const groups: { name: string; pos: [number, number]; children: number[]; subtxt: string; replacement?: string }[] =
			Object.entries(match?.groups ?? []).map(([name, subtxt]) => ({
				name,
				pos: <[number, number]>match?.indices?.groups?.[name]?.map((i) => i - match.index), //Match internal Indexes
				children: [],
				subtxt,
			})); //already sorted by position, no need to sort

		//collect nested groups
		for (let i = 0; i < groups.length; i++) {
			const { pos: pos1 } = groups[i];

			if (d.hide) hideMask = hideMask.fill(false, pos1[0], pos1[1]);

			let lastChildrensEnd = -1;
			for (let j = i + 1; j < groups.length; j++) {
				const { pos: pos2 } = groups[j];
				if (pos2[0] < pos1[1]) {
					if (pos2[0] >= lastChildrensEnd) {
						groups[i].children?.push(j);
						lastChildrensEnd = pos2[1];
					}
					// sub-sub-children handled by sub-children
				} else break;
			}
		}

		let marker = 0xe000;
		if (d.hide) {
			while (processedText.includes(String.fromCharCode(marker)) && marker < 0xf8ff) {
				marker++;
			}

			const [, ...indices] = match.indices ?? [];
			indices.forEach(([start, end]) => hideMask.fill(false, start, end));

			if (d.hide && pattern && d._regex.includes("{{open:") && d._regex.includes("{{close:")) {
				const openMatch = d._regex.match(/{{open:(.*?)}}/);
				const closeMatch = d._regex.match(/{{close:(.*?)}}/);

				if (openMatch && closeMatch) {
					const openTag = openMatch[1];
					const closeTag = closeMatch[1];

					try {
						const openTagRegex = new RegExp(openTag, "g");
						const closeTagRegex = new RegExp(closeTag, "g");

						let openTagMatch = openTagRegex.exec(processedText);
						while (openTagMatch !== null) {
							hideMask.fill(true, openTagMatch.index, openTagMatch.index + openTagMatch[0].length);
							openTagMatch = openTagRegex.exec(processedText);
						}

						let closeTagMatch = closeTagRegex.exec(processedText);
						while (closeTagMatch !== null) {
							hideMask.fill(true, closeTagMatch.index, closeTagMatch.index + closeTagMatch[0].length);
							closeTagMatch = closeTagRegex.exec(processedText);
						}
					} catch (e) {
						const escapedOpenTag = openTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
						const escapedCloseTag = closeTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

						const openTagRegex = new RegExp(escapedOpenTag, "g");
						const closeTagRegex = new RegExp(escapedCloseTag, "g");

						let openTagMatch = openTagRegex.exec(processedText);
						while (openTagMatch !== null) {
							hideMask.fill(true, openTagMatch.index, openTagMatch.index + openTagMatch[0].length);
							openTagMatch = openTagRegex.exec(processedText);
						}

						let closeTagMatch = closeTagRegex.exec(processedText);
						while (closeTagMatch !== null) {
							hideMask.fill(true, closeTagMatch.index, closeTagMatch.index + closeTagMatch[0].length);
							closeTagMatch = closeTagRegex.exec(processedText);
						}
					}
				}
			}

			processedText = processedText
				.split("")
				.map((char, i) => (hideMask[i] ? String.fromCharCode(marker) : char))
				.join("");
		}

		//walk backwards
		for (let i = groups.length - 1; i >= 0; i--) {
			const { name: css, pos, children } = groups[i];
			const mappedChildren = children.map((j) => groups[j]);

			const evaluatedEnd = mappedChildren.reduce(
				(full, { subtxt, replacement }) => full + (replacement?.length ?? NaN) - subtxt.length,
				pos[1]
			);

			const before = processedText.substring(0, pos[0]),
				after = processedText.substring(evaluatedEnd),
				cursubtxt = processedText.substring(pos[0], evaluatedEnd);

			const replacement = `<span data-group="true" class="${css}">${cursubtxt}</span>`;
			groups[i].replacement = replacement;

			processedText = `${before}${replacement}${after}`;
		}

		if (d.hide) {
			const regex = new RegExp(`${String.fromCharCode(marker)}+`, "g");
			processedText = processedText.replace(regex, "");
		}
	}
	mainSpan.innerHTML = processedText.trimStart();
	return parent;
}
