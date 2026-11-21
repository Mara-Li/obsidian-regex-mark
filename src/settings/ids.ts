/**
 * Gives a stable id to objects (rules, auto rules…).
 *
 * The framework finds a page again with its id (path navigation, page kept open after `update()`),
 * so the id must follow the object: not its index in the list, not its name that the user can change.
 */
export class IdRegistry<T extends object> {
	private ids = new WeakMap<T, string>();
	private next = 0;

	constructor(private readonly prefix: string) {}

	get(item: T): string {
		let id = this.ids.get(item);
		if (!id) {
			id = `${this.prefix}-${this.next++}`;
			this.ids.set(item, id);
		}
		return id;
	}
}
