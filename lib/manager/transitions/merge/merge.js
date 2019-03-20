"use strict";

const actionUnify = require("../tuples/actionUnify");
const utils = require("../../../utils");
const Domains = require("../../../variables/domains");

const CSet = require("cset");

const {
    combinations,
    // combinationsGenerator
} = require("../../../variables/combinations");
// const IdenticObjects = require("identicobjects");

/*
function sanatizeDomains(zvs, branchId) {
	const DOMAINS = zvs.data.global("domains");

	const domainsJSON = zvs.getObject(branchId, DOMAINS);
	const domains = Domains.fromJSON(zvs, domainsJSON);

	if (domains) {
		for (let i=domains.variables.length-1; i>=0; i--) {
			const v = domains.variables[i];
			const c = zvs.branches.getDataId(branchId, v);
			const data = zvs.getObject(branchId, v);

			if (data.type === 'tuple') {
				// fail,
				return;
			}
			else if (data.type === 'constant') {
				if (!domains.equalSymbol(v, c)) {
					return;
				}
			}
			else if (data.type === 'variable') {
				zvs.update(branchId, v, {type: "domain"});
			}
		}

		// save domains,
		const saveDomainsJSON = domains.toJSON();
		if (domains.isEmpty()) {
			saveDomainsJSON.branchId = branchId;
		}

		const domainsID = zvs.data.add(saveDomainsJSON);
		zvs.branches.transform(branchId, DOMAINS, domainsID);
	}
	
	return branchId;
}

function getDomains (zvs, branchId) {
	const domains = zvs.getData(branchId, zvs.data.global("domains"));
	const domainsData = zvs.getData(branchId, domains.data);

	if (domainsData) {
		const ids = new Map();
		const all = new Set(domainsData);

		for (let i=0; i<domainsData.length; i++) {
			const d = zvs.branches.getDataId(branchId, domainsData[i]);
			const data = zvs.getData(branchId, d);
			const id = zvs.getData(branchId, data.id);

			ids.set(id, d);
		}

		return {
			ids,
			all
		};
	}
}

function mergeDomains (zvs, branchA, branchB) {
	// get domains ID,
	const DOMAINS_ID = zvs.data.global("domains");

	// get both domains:
	const domainsA = zvs.getData(branchA, DOMAINS_ID);
	const domainsB = zvs.getData(branchB, DOMAINS_ID);

	const domainsAData = new Set(zvs.getData(branchA, domainsA.data));
	const domainsBData = new Set(zvs.getData(branchB, domainsB.data));

	if (!domainsA || !domainsB) {
		throw "empty domain";
	}

	const diffA = new Set(zvs.getData(branchA, domainsA.data));
	const diffB = new Set(zvs.getData(branchB, domainsB.data));

	const allDomainsIDs = new Set([...domainsAData, ...domainsBData]);

	const conflicts = new Map();
	const intersects = new Set();
	const values = new Map();
	const allDomains = new Map();

	for (let id of allDomainsIDs) {
		const a = zvs.branches.getDataId(branchA, id);
		const b = zvs.branches.getDataId(branchB, id);

		const v = zvs.getObject(zvs.branches.root, id);
		if (v.type !== 'variable') {
			throw "V is not a variable!!";
		}

		let domain;
		if (b === id) {
			domain = zvs.getData(branchA, zvs.getData(branchA, id).data);
		}
		else if (a === id) {
			domain = zvs.getData(branchB, zvs.getData(branchB, id).data);

		}
		else if (b !== a) {
			conflicts.set(id, {a, b});

			const aData = zvs.getData(branchA, a);
			const bData = zvs.getData(branchB, b);

			const aType = zvs.getData(branchA, aData.type);
			const bType = zvs.getData(branchB, bData.type);

			let aDomain = aType === 'constant'?[a]:zvs.getData(branchA, aData.data);
			let bDomain = bType === 'constant'?[b]:zvs.getData(branchB, bData.data);

			domain = aDomain.filter(c => bDomain.includes(c));

			// TODO:
			// 		3. if result is constant we will need to remove constant from all domains
			// 			3a. since allDomains may be incomplete, we will need to solve it after loop.
			// 
			// 		Also no more than 2 domains can conflict, if this happens the all merge should fail.

			if (domain.length === 0) {
				// unable to merge domains,

				return [];
			}

			// since domains intersect they are not different,
			// even if id is not equal for both of them, they will get 
			// removed on next found conflict.
			diffA.delete(id);
			diffB.delete(id);

		}
		else {
			domain = zvs.getData(branchA, zvs.getData(branchA, id).data);

			intersects.add({domain: {data: domain, id}, domains: {a: id, b: id}});

			diffA.delete(id);
			diffB.delete(id);

		}

		allDomains.set(id, {
			type: "domain",
			data: domain,
			id
		});
	}

	
	// Merging diff domains are a cartasian product, since only diff domains live only on one branch: 
	// the equal domains values must generate a new branches, so:
	//		1. intersect all diff domains values, for equal values,
	// 		2. generate all branch combinations where values are equal and diff,
	// 		3. create branches.
	// 
	// We only consider different domains and exclude intersected domains, this is because intersected domains are garanted to be 
	// different of all other domains, because they are in both original branches.
	// 
	// So intersected domains are fixed/constant to all branches combinations.
	

	// 1. create all combination of equal domains,
	const equals = new Set();

	for (let a of diffA) {
		const domainA = allDomains.get(a);

		for (let b of diffB) {
			const domainB = allDomains.get(b);
			const r = domainA.data.filter(v => domainB.data.includes(v));

			if (r.length) {
				equals.add({
					domains: {
						a, b
					},
					values: r,
					id: [a, b].sort()[0]
				});
			}
		}
	}

	const e = combinations([...equals]).filter(
		v => {
			const s = new Set();

			for (let i=0; i<v.length; i++) {
				const {domains: {a, b}} = v[i];

				if (s.has(a) || s.has(b)) {
					return false;
				}

				s.add(a);
				s.add(b);
			}

			return true;
		}
	)
	.map(v => {
		const s = new Set(v.reduce((acc, v) => acc.concat([v.domains.a, v.domains.b]), []));

		const r = [...allDomainsIDs].filter(v => !s.has(v));

		for (let i=0; i<r.length; i++) {
			const domainID = r[i];
			const {data: values, id} = allDomains.get(domainID);

			v.push({
				domains: {
					a: domainID
				},
				values,
				id 
			});
		}

		return v;
	});

	const allDiff = [];
	for (let [domainID, {data: values, id}] of allDomains) {

		allDiff.push({
			domains: {
				a: domainID
			},
			values,
			id
		});
	}

	e.push(allDiff);

	const branches = [];
	for (let i=0; i<e.length; i++) {
		const domains = e[i];
		const newDomains = [];
		
		const bA = zvs.branches.getId({
			parent: branchA,
			args: {branches: [branchA, branchB], n: i},
			action: "merge-domains"
		}).branchId;

		const bB = zvs.branches.getId({
			parent: branchB,
			args: {branches: [branchA, branchB], n: i},
			action: "merge-domains"
		}).branchId;

		// Add domains that are equal/diff.
		for (let i=0; i<domains.length; i++) {
			const d = domains[i];

			const domainObject = {
				type: "domain",
				data: d.values.map(id => zvs.getObject(zvs.branches.root, id)),
				id: d.id
			};

			const domainID = zvs.data.add(domainObject);

			newDomains.push(d.id);

			zvs.branches.transform(bA, d.domains.a, domainID);
			zvs.branches.transform(bB, d.domains.a, domainID);

			if (d.domains.b) {
				zvs.branches.transform(bA, d.domains.b, domainID);
				zvs.branches.transform(bB, d.domains.b, domainID);
			}
		}

		// add intersected domains:
		for (let {domain: {data, id}, domains: {a, b}} of intersects) {
			if (data.length === 1) {
				// domain is a constant,
				zvs.branches.transform(bA, a, data[0]);
				zvs.branches.transform(bB, a, data[0]);

				zvs.branches.transform(bA, b, data[0]);
				zvs.branches.transform(bB, b, data[0]);
			}
			else {
				const domainObject = {
					type: "domain",
					data: data.map(id => zvs.getObject(zvs.branches.root, id)),
					id
				};

				const domainID = zvs.data.add(domainObject);

				newDomains.push(id);					

				zvs.branches.transform(bA, a, domainID);
				zvs.branches.transform(bB, a, domainID);

				zvs.branches.transform(bA, b, domainID);
				zvs.branches.transform(bB, b, domainID);
			}
		}

		const newDomainsID = zvs.data.add({
			type: 'domains',
			data: newDomains.map(v => zvs.getObject(zvs.branches.root, v)),
			id: [bA, bB]
		});

		zvs.branches.transform(bA, DOMAINS_ID, newDomainsID);
		zvs.branches.transform(bB, DOMAINS_ID, newDomainsID);

		branches.push({
			a: bA,
			b: bB
		});
	}

	return branches;
}
*/

function addMergeIds (zvs, branches) {
	const DOMAINS_ID = zvs.data.global("domains");

	return branches.map(bs => bs.map(branchId => {
		const domains = zvs.getData(branchId, DOMAINS_ID);
		const domainsData = zvs.getData(branchId, domains.data);

		if (domainsData && domainsData.length) {
			const newBranchId = zvs.branches.getId({
				parent: branchId,
				args: [branchId],
				action: "add-domains-merge-id"
			}).branchId;

			for (let i=0; i<domainsData.length; i++) {
				const domainID=domainsData[i];
				const domain = zvs.getData(branchId, domainID);
				const id = zvs.getData(branchId, domain.id);
				const merge = [[newBranchId, id]];

				zvs.update(newBranchId, domainID, {merge});
			}
			
			return newBranchId;
		}
		else {
			return branchId
		}
	}));
}

// TODO: fix out of memory!!
function equalCombinatorialBranch (zvs, branchId) {

	/**
	 * TODO:
	 * 		- All branches are alredy all diff consistent and complete,
	 * 		- But some domains may be cartasian product to other domains:
	 * 			1. all domains that merge field don't intersect are cartasian product,
	 * 			2. only the ones with intersected values need to make the equal values (cartasian product).
	 */
	/**
	 * 	TODO: we can enconde each branch with ene,
	 * 
	 */

	const DOMAINS_ID = zvs.data.global("domains");
	const domains = zvs.getData(branchId, DOMAINS_ID);
	const domainsData = zvs.getData(branchId, domains.data);

	if (!domainsData || domainsData.length === 0) {
		return [branchId];
	}

	const domainsMap = new Map(domainsData.map(id => {
		const domain = zvs.getObject(branchId, id);
		domain.merge = new Set(domain.merge.map(([mergeID]) => mergeID));

		return [id, domain];
	}));

	/**
	 * TODO: we need to remove combinations with cset
	 */

	const equals = combinations(domainsData).map(d => {
		if (d.length > 1) {
			let merge;
			let values;
			let id;

			for (let i=0; i<d.length; i++) {
				const domainID = d[i];
				const domain = domainsMap.get(domainID);

				if (merge) {
					// 1. union of merge,
					const m = new Set([...merge, ...domain.merge]);

					if (m.size < (merge.size + domain.merge.size)) {
						return;
					}

					// 2. intersect values,
					values = values.filter(v => domain.data.map(v => v.data).includes(v.data));

					if (!values.length) {
						return;
					}

					if (id > domain.id) {
						id = domain.id;
					}
				}
				else {
					merge = domain.merge;
					values = domain.data;
					id = domain.id;
				}
			}

			return {d, values, id};
		}
	})
	.filter(d => d);

	const equalsComb = combinations(equals).map(equals => {
		const domainIDs = [];
		for (let i=0; i<equals.length; i++) {
			const {d} = equals[i];

			for (let i=0; i<d.length; i++) {
				const e = d[i];
				if (domainIDs.includes(e)) {
					return;
				}

				domainIDs.push(e);
			}
		}

		for (let [domainID, domain] of domainsMap) {
			if (!domainIDs.includes(domainID)) {
				equals.push({
					d: [domainID],
					values: domain.data,
					id: domain.id
				});
			}
		}

		/**
		 * TODO: what if some domains are length 1 (constant),
		 * 		* We will need to remove constant from other domains, 
		 * 
		 * FOR ALL DOMAINS/BRANCHES/PHASES:
		 * 		* What if the combinatorial values of domains leads to domains with no values ? In that cases branches should fail 
		 * 		* Ex. a=[0, 1], b=[0, 1], c=[0, 1]
		 * 			+ while none of domains is constant, the fact they are all different makes the domain branch invalid, because at least one 
		 * 			  variable must have the same value.
		 */

		return equals;
	}).filter(v => v);

	/**
	 * Include diff domains,
	 */
	const diff = [];
	for (let [domainID, domain] of domainsMap) {
		diff.push({
			d: [domainID],
			values: domain.data,
			id: domain.id
		});
	}

	equalsComb.push(diff);

	const results = [];

	// create combinations branches,
	for (let i=0; i<equalsComb.length; i++) {
		const comb = equalsComb[i];

		// 1. create branch,
		const newBranchId = zvs.branches.getId({
			parent: branchId,
			args: i,
            action: "domain-combinations"
		}).branchId;

		// 2. transform domains,
		const newDomains = {
			type: "domains",
			data: [],
			id: [newBranchId]			
		};

		for (let i=0; i<comb.length; i++) {
			const {d, values, id} = comb[i];

			let vID;
			if (values.length > 1) {
				const domain = {
					type: "domain",
					data: values,
					id,
					// to force change of branch, by removing merge...
					change: newBranchId
				};

				vID = zvs.data.add(domain);

				newDomains.data.push(domain);
			}
			else {
				vID = zvs.data.add({
					type: "constant",
					data: values[0],
				});
			}

			// transform domains to new value.
			for (let i=0; i<d.length; i++) {
				const domainID = d[i];
				zvs.branches.transform(newBranchId, domainID, vID);
			}
		}

		// 3. save new domains to new branch,
		const newDomainsID = zvs.data.add(newDomains);

		zvs.branches.transform(newBranchId, DOMAINS_ID, newDomainsID);
		results.push(newBranchId);
	}

	return results;
}

/*
	const equalCombinatorialBranches = mergeBranches.map(
		branches => branches.map(
			branchId => equalCombinatorialBranch(zvs, branchId)
		).reduce(
			(acc, branches) => acc.concat(branches), []
		)
	);

*/
function getBranches (zvs, mergeBranches) {

	const branches = [];
	for (let i=0; i<mergeBranches.length; i++) {
		const branchId = mergeBranches[i];
		const DOMAINS_ID = zvs.data.global("domains");
		const domains = zvs.getData(branchId, DOMAINS_ID);

		// TODO: some domains have repeated domain's.
		const domainsData = new Set(zvs.getData(branchId, domains.data));
	
		if (!domainsData || domainsData.size === 0) {
			branches.push(branchId);
		}
		else {
			// branches.push(...equalCombinatorialBranch(zvs, branchId));
			/**
			 * 	- All branches are alredy all diff consistent and complete,
			 * 	- But some domains may be cartasian product to other domains:
			 * 		1. if merge ids don't intersect then domains are catesian product.
			 * 		2. if merge ids interect then all domains are diff. 
			 */

			/** TODO:
			 * 	1. make cartesian product of all domains,
			 *  2. add constrains: make variables on same array diff.
			 */
			let s;
			const domains = [];

			for (let id of domainsData) {
				const domain = zvs.getObject(branchId, id);
				domain.mergeIDs = new Set(domain.merge.map(([mergeID]) => mergeID));
				// domains.push(domain);

				const d = new CSet(domain.data.map(v => v.data)).as(domain.id);
				s = s?s.cartesianProduct(d):d;

				let insert = true;
				for (let i=0; i<domains.length; i++) {
					const ds = domains[i];
					for (let i=0; i<ds.length; i++) {
						const d = ds[i];
						let localInsert = true;

						for (let e of d.mergeIDs) {
							if (domain.mergeIDs.has(e)) {
								insert = false;
								localInsert = false;
								ds.push(domain);
								break;
							}
						}

						if (!localInsert) {
							break;
						}
					}
				}

				if (insert) {
					domains.push([domain]);
				}
			}

			for (let i=0; i<domains.length; i++) {
				const ds = domains[i];
				for (let i=0; i<ds.length-1; i++) {
					const a = ds[i].id;

					for (let j=i+1; j<ds.length; j++) {
						const b = ds[j].id;
						s.constrain(
							[a, b],
							{
								name: "<>",
								predicate: (a, b) => a !== b
							}
						);
					}
				}
			}
			
			branches.push(...equalCombinatorialBranch(zvs, branchId));
		}
	}

	return [branches];
}

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

	// const results = getBranches(zvs, mergeBranches[0]);

	// results[0].forEach(branchId => utils.checkBranch(zvs, branchId, "MERGE CHECK END"));

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


function _merge (action, data, destination, session) {
	const zvs = session.zvs;
	const { branches } = data;


	for (let i=0; i<branches.length; i++) {
		const bs = branches[i];

		for (let i=0; i<bs.length; i++) {
			const branchId = bs[i];
			utils.checkBranch(zvs, branchId, "MERGE CHECK START");
		}
	}

	// prepare branches before merge,
	const mergeBranches = addMergeIds(zvs, branches);

	mergeBranches.forEach(bs => bs.forEach(branchId => utils.checkBranch(zvs, branchId, "MERGE [MERGE ID] CHECK END")));


	/**
	 * order branches groups by size,
	 */
	while (mergeBranches.length > 1) {
		mergeBranches.sort((a, b) => b.length - a.length);

		const a = mergeBranches.pop();
		const b = mergeBranches.pop();

		let nr = [];

		for (let i = 0; i < a.length; i++) {
			const bA = a[i];

			for (let j = 0; j < b.length; j++) {
				let bB = b[j];

				let bs = zvs.merge(
					[bA, bB],
					actionUnify,
					"unify&merge"
				);

				if (bs && bs.length) {
					nr = nr.concat(bs);
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

		mergeBranches.push(nr);
	}

	/*
	const result = mergeBranches[0];

	console.log(JSON.stringify(result));
	*/

	const results = getBranches(zvs, mergeBranches[0]);

	/*
	const results = mergeBranches.map(
		branches => branches.map(
			branchId => equalCombinatorialBranch(zvs, branchId)
		).reduce(
			(acc, branches) => acc.concat(branches), []
		)
	);

	console.log(JSON.stringify(results));
	*/

	results[0].forEach(branchId => utils.checkBranch(zvs, branchId, "MERGE CHECK END"));

	session.postOffice.addActives(destination, 1);
	session.queue.put({
		action: "checkNegations",
		data: {
			branches: results
		},
		destination
	});

	session.postOffice.subActives(destination, 1);

	/*
	// TODO: rewrite this...

	session.postOffice.addActives(destination, 1);
	session.queue.put({
		// action: "filterUncheckedNegations",
		action: "checkNegations",
		data: {
			branches: equalCombinatorialBranches
		},
		destination
	});

	session.postOffice.subActives(destination, 1);
	*/
}

module.exports = merge;
