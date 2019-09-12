"use strict";

const Data = require("./data");
const Branches = require("./branches");
// const {Events} = require("kanban-pipeline");
const utils = require("../utils");
// const zvsContracts = require("../contracts/zvscontracts");


function getTopCode (code, changes) {
	// TODO: why changes points to same code eg. "1": 1 ??
	while (changes[code] !== undefined && changes[code] !== code) {
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

		/**
		 * 1) Proxy this object, 
		 * 2) Make a generic contract class to listen methods, and call before and after methods,
		 */
		// return new zvsContracts(this);
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

	// TODO: branches.table makes the same ??
	getChangesCodes (branchesHashs) {
		const codes = {};
		branchesHashs = branchesHashs.slice(0);

		for (let i = 0; i < branchesHashs.length; i++) {
			const branchHash = branchesHashs[i];
			const branch = this.branches.getRawBranch(branchHash);

			if (branch.metadata.changes) {
				Object.assign(codes, branch.metadata.changes);

				for (let c in branch.metadata.changes) {
					const v = this.getObject(this.branches.root, +c);
					if (v.type === 'constant') {
						throw "Bad constant value at rigth side of changes : branch => " + branchHash;
					}
				}
			}

			if (
				typeof branch.data.parent === "number" &&
				branchesHashs.indexOf(branch.data.parent) === -1
			) {
				branchesHashs.push(branch.data.parent);
			}
		}

		for (let i in codes) {
			if (codes.hasOwnProperty(i)) {
				codes[i] = [];
			}
		}

		return codes;
	}

	merge (
		branchesHashs,
		conflictHandler,
		action
	) {
		if (branchesHashs.length <= 1) {
			return branchesHashs;
		}

		const changes = this.getChangesCodes(branchesHashs);

		for (let code in changes) {
			if (changes.hasOwnProperty(code)) {				
				code = +code;
				for (let i = 0; i < branchesHashs.length; i++) {
					const newCode = this.branches.getDataId(branchesHashs[i], code);
					const cs = changes[code];

					if (
						newCode !== code &&
						cs.indexOf(newCode) === -1
					) {
						cs.push(newCode);
					}
				}
			}
		}

		// 28 is transformed to 17 (real -> int)
		// constant can not ever be on the rigth side of changes, we need to find transform that makes that. 
		let conflicts = {};

		for (let code in changes) {
			if (changes.hasOwnProperty(code)) {
				code = +code;
				const cs = changes[code];

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

		const level = this.branches.getLevel(branchesHashs[0]) + 1;

		let bHash = this.branches.getId({
			parent: branchesHashs,
			args: branchesHashs.slice(0),
			action: action || "_merge",
			level: level
		}).branchId;

		let rawBranch = this.branches.getRawBranch(bHash);

		rawBranch.metadata.changes = changes;

		let branches = [];

		for (let code in conflicts) {
			if (conflicts.hasOwnProperty(code)) {
				code = +code;
				const cs = conflicts[code];

				// TODO: conflict handler should prepare branches for next merge!! 

				const b = conflictHandler(this, { branchId: bHash, args: cs });

				if (!b) {
					return;
				}

				if (!branches.includes(b)) {
					branches.push(b);
				}
			}
		}

		if (branches.length === 0) {
			return [bHash];
		}

		return this.merge(branches, conflictHandler);
	}

	// TODO: we need to get a better definitions/version system,
	// TODO: we need to start making zvs very specific to zebrajs.
	addDefinitionsMatch (definitionsBranchId, match) {
		this.definitionsMatch[definitionsBranchId] = match;
	}

	toJSON () {
		const result = {};

		for (let branchId in this.branches.branches) {
			const b = this.branches.getRawBranch(branchId);

			const branch = result[branchId] = {
				...(result[branchId] || {}),
				branchId,
				action: b.data.action,
				args: utils.branchArgs(this, branchId, b),
				query: utils.toString(
					this.getObject(
						branchId,
						this.data.global("query")
					)
				),
				children: []
			};

			if (b.data.parent) {
				if (b.data.parent instanceof Array) {
					for (let i=0; i<b.data.parent.length; i++) {
						const bID = b.data.parent[i];

						const parent = result[bID] = result[bID] || {
							branchId: bID,
							children: []
						};

						parent.children.push(branch);
					}
				}
				else {
					const parent = result[b.data.parent] = result[b.data.parent] || {
						branchId: b.data.parent,
						children: []
					};

					parent.children.push(branch);
				}
			}
		}

		return result[this.branches.root];
	}

	/* 
	  == Debug == 
	*/
	debugCheckCycleId (branchId) {

		const branch = this.branches.getRawBranch(branchId);

		for (let id in branch.metadata.changes) {
			let c;
			let b;
			let bh = branchId;
			let stack = [];

			do {
				id = c || id;

				b = this.branches.getRawBranch(bh);
				c = b.metadata.changes[id];			
	
				if (c === undefined) {
					if (typeof b.data.parent === "number") {
						bh = b.data.parent;
					}
					else {
						c = id;
					}
				}
				else {
					if (!stack.includes(id)) {
						stack.push(id);
					}
					else {
						throw "Cycle id " + branchId + "::" + id + " = " + bh + "::"+ b.metadata.changes[id];
					}

					bh = branchId;
				}
			} while (c !== id);
		}

		/*if (typeof branch.data.parent === "number") {
			this.debugCheckCycleId(branch.data.parent);
		}*/

	}

	debugCheckDomains (branchId) {
		const DOMAINS_ID = this.data.global("domains");
		const domainsData = this.getData(branchId, DOMAINS_ID);
	
		if (domainsData.data) {
			const domainsIDs = this.getData(branchId, domainsData.data)
				.map(id => this.branches.getDataId(branchId, id));
	
			const QUERY_ID = this.data.global("query");
			const query = this.getData(branchId, QUERY_ID);
			const queryData = this.getData(branchId, query.data);
			const negations = this.getData(branchId, query.negations);
	
			if (queryData === undefined) {
				const branch = this.branches.getRawBranch(branchId);
	
				throw "\n\n--- ERROR: Query is undefined when domainsData is defined. ---\n" +
					JSON.stringify(branch)	
			}
	
			const ids = [...queryData, ...(negations || [])].map(
				id => this.branches.getDataId(branchId, id)
			);
			
			const queryDomainIds = [];
	
			while (ids.length) {
				const id = ids.pop();
	
				const data = this.getData(branchId, id);
				const type = this.getData(branchId, data.type);
	
				if (type === 'domain') {
					if (!queryDomainIds.includes(id)) {
						queryDomainIds.push(id);
					}
				}
				else if (type === 'tuple') {
					const tupleData = this.getData(branchId, data.data);
	
					for (let i=0; i<tupleData.length; i++) {
						const tID = this.branches.getDataId(branchId, tupleData[i]);
						ids.push(tID);
					}
				}
			}
	
			const intersect = domainsIDs.filter(id => queryDomainIds.includes(id));
	
			if (/*intersect.length !== domainsIDs.length ||*/ intersect.length !== queryDomainIds.length) {
				const branch = this.branches.getRawBranch(branchId);
	
				throw "\n\n--- ERROR: Query Domains, mismatch query domains body ---\n" +
					JSON.stringify(domainsIDs) + "(D) & " + 
					JSON.stringify(queryDomainIds) + "(Q) = " +
					JSON.stringify(intersect) + "(D&Q)\n\n" +  
					JSON.stringify(branch)
				;
			}
	
		}
	}
	
	debugCheckTree (branchId) {
		this.debugCheckDomains(branchId);
		this.debugCheckCycleId(branchId);
	}
}

module.exports = ZVS;
