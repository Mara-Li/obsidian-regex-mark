
export function removeTags(regex: string) {
	return regex.replace(/{{open:(.*?)}}/, "$1").replace(/{{close:(.*?)}}/, "$1");
}

export function isValidRegex(regex: string) {
	try {
		new RegExp(removeTags(regex));
		return true;
	} catch (e) {
		console.warn(`Invalid regex: ${regex}`);
		return false;
	}
}