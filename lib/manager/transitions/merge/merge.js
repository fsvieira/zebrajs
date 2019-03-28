"use strict";

const actionUnify = require("../tuples/actionUnify");
const utils = require("../../../utils");
const Table = require("../../domains/table");

/*
	Branch A * B
		- domains:
			- a = b, a intersect b,
			- common domains, a * b where a <> b.
			- diff domains cartesian product a * b.

		- get domains classification:
			- a:A <> a:B, a in A, B. (AB).
			- a:A = b:B, where a in A, b in B, (AB).
			- remaining domains are diff.  
			
*/

function getBranchIds (zvs, branchId) {
	const DOMAINS_ID = zvs.data.global("domains");
	const table = new Map();
	const t = zvs.branches.table(branchId);

	const domains = new Set((zvs.getData(
		branchId,
		zvs.getData(branchId, DOMAINS_ID).data
	) || []).map(id => zvs.branches.getDataId(branchId, id)));

	for (let v in t) {
		const id = t[v];
		const s = table.get(id);

		/**
		 * TODO:
		 * 	 - since we inverted the change table, constants may appear on left side 
		 * 		of the returned table.
		 * 
		 * 	 1. For domains, this will work great, since we want the last changed code,
		 *   2. For constants, it means a domains was changed into a constant:
		 * 		2a. then intersected domain should also be a constant, and only that domain should be changed,
		 * 			* Attempting to change constant to constant should be ignored, as they would have same ids.
		 * 		2b. if domain as no intersection then it shouldn't appear on domains, and we are ok!!
		 * 
		 */

		if (s) {
			s.add(+v);
		}
		else {
			table.set(id, new Set([+v]));
		}
	}

	return {
		table,
		domains
	};
}

function getDomainsMap (a, b) {
	const ab = new Map();

	for (let da of a.domains) {
		const aIds = a.table.get(da) || new Set();
		aIds.add(da);

		const s = new Set();
		ab.set(da, s);

		for (let db of b.domains) {
			const bIds = b.table.get(db) || new Set();
			bIds.add(db);

			for (let bId of bIds) {
				if (aIds.has(bId)) {
					s.add(db)
					break;
				}
			}
		}
	}

	return ab;
}

function *solveDomains (zvs, branchA, branchB) {
	const a = getBranchIds(zvs, branchA);
	const b = getBranchIds(zvs, branchB);

	const mapAB = getDomainsMap(a, b);
	const mapBA = getDomainsMap(b, a);

	if (mapAB.size || mapBA.size) {
		const ab = new Map();
		const axb = new Map();
		const singleA = new Map();
		const singleB = new Map();
		
		// 1. Check that domains don't have more than one matching domain,
		// if domains have more than one match domain than branches can't 
		// merged because it means two different domains need to be merged.
		for (let [a, b] of mapAB) {
			if (b.size > 1) {
				return;
			}
			else if (b.has(a)) {
				// 2. if ids are the same, then we don't need to change them.
				ab.set(a, zvs.getData(branchA, zvs.getData(branchA, a).data));
			}
			else if (b.size === 0) {
				const bID = zvs.branches.getDataId(branchB, a);
				const type = zvs.getData(branchB, zvs.getData(branchB, bID).type);

				const aDomain = zvs.getData(branchA, zvs.getData(branchA, a).data);

				if (type === 'constant') {
					axb.set(a, [
						[bID],
						aDomain
					]);
				}
				else {
					singleA.set(a, aDomain);
				}
			}
			else {
				// 3. domains intersect,
				const aObj = zvs.getData(branchA, a);
				const aType = zvs.getData(branchA, aObj.type);

				let aData;
				if (aType === 'constant') {
					aData = [a];
				}
				else {
					aData = zvs.getData(branchA, aObj.data);
				}

				const bID = b.values().next().value;
				const bObj = zvs.getData(branchB, bID);
				const bType = zvs.getData(branchB, bObj.type);

				let bData;
				if (bType === 'constant') {
					bData = [bID];
				}
				else {
					bData = zvs.getData(branchA, bObj.data);
				}

				axb.set(a, [
					aData,
					bData
				]);
			}
		}
		
		for (let [b, a] of mapBA) {
			if (a.size > 1) {
				return;
			}
			else if (a.size === 0) {
				const aID = zvs.branches.getDataId(branchB, b);
				const type = zvs.getData(branchB, zvs.getData(branchB, aID).type);
				const bDomain = zvs.getData(branchB, zvs.getData(branchB, b).data);

				if (type === 'constant') {
					axb.set(aID, [
						[aID],
						bDomain
					]);
				}
				else {
					singleB.set(b, bDomain);
				}
			}
		}

		const header = [...new Set([
			...ab.keys(),
			...axb.keys(),
			...singleA.keys(),
			...singleB.keys()
		])].sort();

		const table = new Table(header);
		table.sameIntersectSingles(ab, axb, singleA, singleB);

		// 3. Use CSet:
		// 3a. mapAB constains all domains that need to be instersected (user a id for .as()),
		// 3b. Set all domains as cartesian product,
		// 3c. Set constrains:
		// 		* intersected domains are all different from all domains,
		//		* single domains "a" are all different from each other (intersect + domains a).
		//		* single domains "b" are all different from each other (intersect + domains b).

		// If results set is empty, then return branches can't be merged.
		// else generete ENE encoding:
		// 	for each ene result, create two branches where domains are overwriten by new domains.

		const ene = table.toENE();
		const tA = table.eneBranches (zvs, ene, branchA, [branchA, branchB], "domains-merge");

		//  rewrite ene with b ids,
		for (let i=0; i<ene.solution.length; i++) {
			const s = ene.solution[i];
			for (let i=0; i<s.variables.length; i++) {
				const vs = s.variables[i];

				for (let i=0; i<vs.length; i++) {
					const v = vs[i];

					const bID = mapAB.get(v);
					if (bID && bID.length) {
						vs[i] = bID[0];
					}
				}
			}

			for (let i=0; i<s.domains.length; i++) {
				const [v] = s.domains[i];
				const bID = mapAB.get(v);
				if (bID && bID.length) {
					s.domains[i][0] = bID[0];
				}
			}
		}

		const tB = table.eneBranches (zvs, ene, branchB, [branchA, branchB], "domains-merge");

		for(;;) {
			const bA = tA.next();
			const bB = tB.next();

			if (bA.done && bB.done) {
				return;
			}

			yield [bA.value, bB.value];
		}
		
		// console.log("ENE => " + JSON.stringify(ene.solution));
	}

	yield [branchA, branchB];
}

function merge (action, data, destination, session) {
	const zvs = session.zvs;
	const { branches } = data;

	/**
	 * order branches groups by size,
	 */
	while (branches.length > 1) {
		branches.sort((a, b) => b.length - a.length);

		const a = branches.pop();
		const b = branches.pop();

		let nr = [];

		for (let i = 0; i < a.length; i++) {
			const bA = a[i];

			for (let j = 0; j < b.length; j++) {
				let bB = b[j];

				for (let [a, b] of solveDomains(zvs, bA, bB)) {

					let bs = zvs.merge(
						[a, b],
						actionUnify,
						"unify&merge"
					);
	
					if (bs && bs.length) {
						nr = nr.concat(bs);
					}
				}
			}
		}

		if (nr.length === 0) {
			// everything fails,
			//  fail,
			//  TODO: we need to fail father branch,
			//  zvs.branches.notes(
			//	branchId,
			//	{status: {fail: true, reason: "merge fail!"}});

			session.postOffice.subActives(destination, 1);

			return;
		}

		branches.push(nr);
	}

	session.postOffice.addActives(destination, 1);
	session.queue.put({
		action: "checkNegations",
		data: {
			branches
		},
		destination
	});

	session.postOffice.subActives(destination, 1);
}

module.exports = merge;
