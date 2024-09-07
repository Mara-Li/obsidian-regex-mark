import type { Pattern } from "./interface";

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
