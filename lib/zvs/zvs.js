"use strict";

const Data = require("./data");
const Branches = require("./branches");
// const {Events} = require("kanban-pipeline");

function getTopCode (code, changes) {
	while (changes[code]) {
		code = changes[code];
	}

	return code;
}

class ZVS {
	constructor () {
		this.version = {
			major: 1,
			minor: 0,
			patch: 0
		};

		this.data = new Data();
		this.branches = new Branches();
		this.actions = {};
		this.definitionsMatch = {};
	}

	getRawData (branchId, dataId) {
		return this.data.get(this.branches.getDataId(branchId, dataId));
	}

	getData (branchId, dataId) {
		let data = this.getRawData(branchId, dataId);
		return data ? data.data : undefined;
	}

	update (branchId, id, obj) {
		let o = this.getData(branchId, id);
		let clone = Object.assign({}, o);

		for (let i in obj) {
			if (obj.hasOwnProperty(i)) {
				let a = this.data.add(obj[i]);
				clone[i] = a;
			}
		}

		this.branches.transform(branchId, id, this.data.getId(clone));
	}

	getObject (branchId, dataId) {
		branchId = branchId || this.branches.root;

		let obj = this.getData(branchId, dataId);
		let r;
		let self = this;

		if (obj instanceof Array) {
			r = obj.map(
				o => {
					return self.getObject(branchId, o);
				}
			);
		}
		else if (typeof obj === "object") {
			r = {};
			for (let i in obj) {
				if (obj.hasOwnProperty(i)) {
					r[i] = this.getObject(branchId, obj[i]);
				}
			}
		}
		else {
			r = obj;
		}

		return r;
	}

	/*
		This will get all updated ids of the given dataId and record it
		on branch changes.
	*/
	getUpdatedId (branchId, dataId, stack) {

		stack = stack || [];
		if (stack.indexOf(dataId) !== -1) {
			// throw "Invalid data found " + dataId + ", is cyclic!!";
			// Data definition is cyclic and therefor does not exists.
			console.log("Cyclic data found " + dataId);
			return;
		}

		stack.push(dataId);

		dataId = this.branches.getDataId(branchId, dataId);

		let t = this.data.get(dataId).data;
		let dirty = false;

		if (t instanceof Array) {
			// clone array,
			t = t.slice(0);

			for (let i = 0; i < t.length; i++) {
				const id = this.getUpdatedId(branchId, t[i], stack.slice(0));

				if (id === undefined) {
					return;
				}

				if (t[i] !== id) {
					dirty = true;
				}

				t[i] = id;
			}
		}
		else if (typeof t === "object") {
			// clone object,
			t = Object.assign({}, t);
			for (let i in t) {
				if (t.hasOwnProperty(i)) {
					const id = this.getUpdatedId(
						branchId,
						t[i],
						stack.slice(0)
					);

					if (id === undefined) {
						return;
					}

					if (t[i] !== id) {
						dirty = true;
					}

					t[i] = id;
				}
			}
		}

		if (dirty) {
			const id = this.data.getId(t);
			this.branches.transform(branchId, dataId, id);
			dataId = id;
		}

		return dataId;
	}

	getChangesCodes (branchsHashs) {
		let codes = {};
		branchsHashs = branchsHashs.slice(0);

		for (let i = 0; i < branchsHashs.length; i++) {
			let branchHash = branchsHashs[i];
			let branch = this.branches.getRawBranch(branchHash);

			if (branch.metadata.changes) {
				Object.assign(codes, branch.metadata.changes);
			}

			if (
				typeof branch.data.parent === "number" &&
				branchsHashs.indexOf(branch.data.parent) === -1
			) {
				branchsHashs.push(branch.data.parent);
			}
		}

		for (let i in codes) {
			if (codes.hasOwnProperty(i)) {
				codes[i] = [];
			}
		}

		return codes;
	}

	merge (branchsHashs, conflictHandler, action) {
		if (branchsHashs.length <= 1) {
			return branchsHashs;
		}

		let changes = this.getChangesCodes(branchsHashs);
		let cs;
		let newCode;

		for (let code in changes) {
			if (changes.hasOwnProperty(code)) {
				if (isNaN(+code)) {
					console.log(code);
				}
				
				code = +code;
				for (let i = 0; i < branchsHashs.length; i++) {
					newCode = this.branches.getDataId(branchsHashs[i], code);
					cs = changes[code];

					if (
						newCode !== code &&
						cs.indexOf(newCode) === -1
					) {
						cs.push(newCode);
					}
				}
			}
		}

		let conflicts = {};

		for (let code in changes) {
			if (changes.hasOwnProperty(code)) {
				code = +code;
				cs = changes[code];

				changes[code] = cs[0];

				if (cs.length > 1) {
					conflicts[code] = cs;
				}
			}
		}

		// remove defers,
		// defers will never occur on conflits,
		for (let code in changes) {
			if (changes.hasOwnProperty(code)) {
				code = +code;
				changes[code] = getTopCode(code, changes);
			}
		}

		// remove codes that don't change,
		for (let code in changes) {
			if (changes.hasOwnProperty(code)) {
				code = +code;
				if (changes[code] === code) {
					delete changes[code];
				}
			}
		}

		const level = this.branches.getLevel(branchsHashs[0]) + 1;

		let bHash = this.branches.getId({
			parent: branchsHashs,
			args: branchsHashs.slice(0),
			action: action || "_merge",
			level: level
		}).branchId;

		let rawBranch = this.branches.getRawBranch(bHash);

		rawBranch.metadata.changes = changes;

		let branchs = [];

		for (let code in conflicts) {
			if (conflicts.hasOwnProperty(code)) {
				code = +code;
				cs = conflicts[code];
				let b = conflictHandler(this, { branchId: bHash, args: cs });

				if (!b) {
					return;
				}

				branchs.push(b);
			}
		}

		if (branchs.length === 0) {
			return [bHash];
		}

		return this.merge(branchs, conflictHandler);
	}

	// TODO: we need to get a better definitions/version system,
	// TODO: we need to start making zvs very specific to zebrajs.
	addDefinitionsMatch (definitionsBranchId, match) {
		this.definitionsMatch[definitionsBranchId] = match;
	}
}

module.exports = ZVS;
