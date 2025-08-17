import { cloneDeep } from "lodash";
import { type App, sanitizeHTMLToDom, type TFile } from "obsidian";
import type { PatternObj } from "./interface";
import { MarkRule } from "./model";
import { DEFAULT_PATTERN } from "./interface";

export function removeTags(regex: string, pattern: PatternObj = DEFAULT_PATTERN) {
	if (!regex) return regex;
	const patternReg = new RegExp(`^(?:${pattern.open})?(.*?)(?:${pattern.close})?$`);
	return regex.replace(patternReg, "$1($2)$3");
}

export function valideRegexSyntax(regex: string, flags = "g") {
	try {
		new RegExp(regex, flags);
		return true;
	} catch {
		return false;
	}
}

export function regexMayMatchNewlineCharacter(regex: string) {
	regex = regex.replace(/\\{2}/gm, ""); //clean "\";

	//check negated
	const negativeReg = /\[\^(.*?[^\\])]|\[\^]/gm;
	const [...negativeMatches] = regex.match(negativeReg) || [];

	return (
		negativeMatches.some((m) => !m.includes("\\n")) || //check negated
		!!regex.replace(negativeReg, "").match(/\\(?:n|s|u000A|u000D|u2028|u2029)/)
	); //check positive
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

export function applyRuleClasses(
	text: string,
	d: MarkRule,
	match: RegExpExecArray,
	hideReplacementFunction: (hideText: string) => string = () => ""
): DocumentFragment {
	const mainSpan = document.createElement("span");
	mainSpan.setAttribute("data-group", "false");
	mainSpan.setAttribute("class", d.class);
	mainSpan.setAttribute("data-contents", match[0]);
	mainSpan.setAttribute("data-processed", "true");

	const preNode = sanitizeHTMLToDom(text.substring(0, match.index));
	const afterNode = sanitizeHTMLToDom(text.substring(match.index + match[0].length));

	let processedText = match[0];

	if (processedText) {
		const groups: { name: string; pos: [number, number]; children: number[]; subtxt: string; replacement?: string }[] =
			!match.groups
				? []
				: Object.entries(match.groups).map(([name, subtxt]) => ({
						name,
						pos: <[number, number]>match?.indices?.groups?.[name]?.map((i) => i - match.index), //Match internal Indexes
						children: [],
						subtxt,
					})); //already sorted by position, no need to sort

		//collect nested groups and group lengths
		for (let i = 0; i < groups.length; i++) {
			const { pos: pos1 } = groups[i];

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

		if (d.hide && d.patternSubRegex.close) {
			processedText = processedText.replace(d.patternSubRegex.close, hideReplacementFunction);
		}
		//walk backwards
		for (let i = groups.length - 1; i >= 0; i--) {
			const { name, pos, children, subtxt } = groups[i];
			const mappedChildren = children.map((j) => groups[j]);

			const evaluatedEnd = mappedChildren.reduce(
				(full, { subtxt, replacement }) => full + (replacement?.length ?? 0) - subtxt.length,
				pos[1]
			);

			const before = processedText.substring(0, pos[0]),
				cursubtxt = processedText.substring(pos[0], evaluatedEnd),
				after = processedText.substring(evaluatedEnd);

			const replacement = `<span data-group="true" data-contents="${subtxt}" class="${name}">${cursubtxt}</span>`;
			groups[i].replacement = replacement;

			processedText = `${before}${replacement}${after}`;
		}
		if (d.hide && d.patternSubRegex.open) {
			processedText = processedText.replace(d.patternSubRegex.open, hideReplacementFunction);
		}
	}
	mainSpan.innerHTML = processedText.trimStart();

	const parent = new DocumentFragment();
	parent.append(preNode, mainSpan, afterNode);
	return parent;
}
