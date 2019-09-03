
class Ids {

	constructor () {
		this.table = {};
		this.ids = 1;
	}

	id (obj) {
		const key = JSON.stringify(obj);
		let id = this.table[key];

		if (id === undefined) {
			this.table[key] = id = this.ids;
			this.ids++;
		}

		return id;
	}

	hasId (id) {
		return this.table[id] !== undefined;
	}

	getId (obj) {
		const key = JSON.stringify(obj);
		return this.table[key];
	}
}

module.exports = Ids;
