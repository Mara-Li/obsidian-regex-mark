import { cloneDeep } from "lodash";
import type { App, TFile } from "obsidian";
import type { AutoRules, Pattern, SettingOption } from "./interface";

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
	return removeTags(regex, pattern).match(/\((.*?)\)/);
}

export function extractGroups(regex: string): string[] {
	const groupPattern = /\(\?<([a-zA-Z_][a-zA-Z0-9_]*)>/g;
	const groups: string[] = [];

	let match;
	//biome-ignore lint/suspicious/noAssignInExpressions: let match be reused
	while ((match = groupPattern.exec(regex)) !== null) {
		// match[1] contient le nom du groupe
		groups.push(match[1]);
	}

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

export function matchGroups(regex: string, text: string): Record<string, { text: string; input: string }> | null {
	const groupPattern = new RegExp(regex);
	const match = groupPattern.exec(text);

	if (!match) return null;

	const groupNames = extractGroups(regex);
	const result: Record<string, { text: string; input: string }> = {};

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
