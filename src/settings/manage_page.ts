import type { SettingGroupItem } from "obsidian";

interface ManagePageOptions {
	/**
	 * Must stay the same between two builds of the definitions: the framework finds the open page again with it
	 */
	id: string;
	name: string;
	desc: string;
	emptyState: string;
	visible?: () => boolean;
	/**
	 * The rows to reorder. `name` and `desc` are read at each render, so they can be getters.
	 */
	rows: { name: string; desc?: string }[];
	onReorder: (oldIndex: number, newIndex: number) => void;
}

/**
 * A page to reorder the entries of a list.
 *
 * The framework only adds the drag handle to the rows of a list that are not pages,
 * so the entries that are pages (the regexes, the auto rules) are reordered from here.
 */
export function managePage(options: ManagePageOptions): SettingGroupItem {
	const { id, name, desc, emptyState, visible, rows, onReorder } = options;
	return {
		type: "page",
		id,
		name,
		desc,
		visible,
		items: [
			{
				type: "list",
				emptyState,
				onReorder,
				items: rows.map(descriptor),
			},
		],
	} as SettingGroupItem;
}

/**
 * Copy `name` and `desc` as getters (a spread would freeze their value)
 */
function descriptor(row: { name: string; desc?: string }) {
	return {
		searchable: false,
		get name() {
			return row.name;
		},
		get desc() {
			return row.desc;
		},
	};
}
