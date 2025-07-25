import { cloneDeep } from "lodash";
import { type App, sanitizeHTMLToDom, type TFile } from "obsidian";
import type { AutoRules, Pattern, SettingOption, SubGroups } from "./interface";

export function removeTags(regex: string, pattern?: Pattern) {
	if (!pattern) return regex.replace(/{{open:(.*?)}}/, "$1").replace(/{{close:(.*?)}}/, "$1");
	const open = new RegExp(pattern.open);
	const close = new RegExp(pattern.close);
	return regex.replace(open, "$1").replace(close, "$1");
}

export const isInvalid = (regex: string) => {
	return regex.match(/(.*)\[\^(.*)\](.*)/) && !regex.match(/(.*)\[\^(.*)\\n(.*)\](.*)/);
};

export function isValidRegex(regex: string, warn = true, pattern?: Pattern) {
	if (isInvalid(regex)) {
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

function checkValue(value: unknown, regex: RegExp, rule: AutoRules): boolean | "none" {
	if ((typeof value === "string" || typeof value === "number") && regex.test(value.toString())) return !rule.exclude;
	else if (Array.isArray(value) && value.length > 0) return value.some((v) => checkValue(v, regex, rule));
	else if (typeof value === "object" && value != null)
		return Object.values(value).some((v) => checkValue(v, regex, rule));
	return "none";
}

export function getFrontmatter(file: TFile | null, app: App): Record<string, unknown> | null {
	if (!file) return null;

	const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
	return frontmatter ? cloneDeep(frontmatter) : null;
}

function isNotExist(value: unknown, frontmatter?: Record<string, unknown> | null) {
	return !frontmatter || value == null || (Array.isArray(value) && value.length === 0);
}

export function includeFromSettings(app: App, propertyName: string, autoRules?: AutoRules[]): boolean {
	const filePath = getFile(app);
	const frontmatter = getFrontmatter(filePath, app);
	if (!filePath || !autoRules || autoRules.length === 0) return true;
	for (const rule of autoRules) {
		if (rule.type === "path") {
			const regex = new RegExp(rule.value);
			if (regex.test(filePath.path)) {
				return !rule.exclude; // If exclude is true, return false
			}
		} else if (rule.type === "frontmatter") {
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

export function matchGroups(regex: string, text: string): SubGroups | null {
	const groupPattern = new RegExp(regex);
	const match = groupPattern.exec(text);

	if (!match) return null;

	const groupNames = extractGroups(regex);
	const result: SubGroups = {};

	groupNames.forEach((groupName) => {
		if (match.groups && match.groups[groupName] !== undefined) {
			result[groupName] = {
				text: match.groups[groupName],
				input: match[0],
			};
		}
	});
	if (Object.keys(result).length === 0) return null;
	return result;
}

export function shouldSkip(d: SettingOption, app: App, propertyName: string, pattern?: Pattern): boolean {
	return (
		!d.regex ||
		!d.class ||
		d.regex === "" ||
		d.class === "" ||
		!isValidRegex(d.regex, true, pattern) ||
		!includeFromSettings(app, propertyName, d.viewMode?.autoRules)
	);
}

export function addGroupText(
	text: string,
	d: SettingOption,
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

			if (d.hide && pattern && d.regex.includes("{{open:") && d.regex.includes("{{close:")) {
				const openMatch = d.regex.match(/{{open:(.*?)}}/);
				const closeMatch = d.regex.match(/{{close:(.*?)}}/);

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
