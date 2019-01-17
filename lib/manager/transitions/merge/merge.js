"use strict";

const actionUnify = require("../tuples/actionUnify");
const utils = require("../../../utils");
const Domains = require("../../../variables/domains");
const combinations = require("../../../variables/combinations");
// const IdenticObjects = require("identicobjects");

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

function _merge (action, data, destination, session) {
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
				
				let bs = zvs.merge(
					[bA, bB],
					actionUnify,
					"unify&merge"
				);

				if (bs && bs.length) {
					for (let i=bs.length-1; i>=0; i--) {
						const b = bs[i];

						if (!sanatizeDomains(zvs, b)) {
							bs.splice(i, 1);
						}
					}

					if (bs.length) {
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

			// console.log("FAIL TO MERGE!!");

			session.postOffice.subActives(destination, 1);

			return;
		}

		branches.push(nr);
	}
	
	session.postOffice.addActives(destination, 1);
	session.queue.put({
		action: "filterUncheckedNegations",
		data: {
			branches
		},
		destination
	});

	session.postOffice.subActives(destination, 1);
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

	console.log("A.1 => " + JSON.stringify([...domainsAData]));
	console.log("B.1 => " + JSON.stringify([...domainsBData]));

	const conflicts = new Map();
	const intersects = new Set();
	const values = new Map();
	const allDomains = new Map();

	for (let id of allDomainsIDs) {
		const a = zvs.branches.getDataId(branchA, id);
		const b = zvs.branches.getDataId(branchB, id);

		const v = zvs.getObject(zvs.branches.root, id);
		if (v.type !== 'variable') {
			console.log("ID ---> " + JSON.stringify(zvs.getObject(zvs.branches.root, id)));
			throw "V is not a variable!!";
		}

		let domain;
		if (b === id) {
			console.log("Found original variable on b => " + 
				JSON.stringify(zvs.getObject(branchB, b)) + " <> " +
				JSON.stringify(zvs.getObject(branchA, a))
			);

			domain = zvs.getData(branchA, zvs.getData(branchA, id).data);
		}
		else if (a === id) {
			console.log("Found original variable on a => " + 
				JSON.stringify(zvs.getObject(branchA, a)) + " <> " + 
				JSON.stringify(zvs.getObject(branchB, b))
			);

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

			console.log("Conflict solver " + 
				JSON.stringify(aDomain.map(c => zvs.getObject(zvs.branches.root, c))) + " ** " +
				JSON.stringify(bDomain.map(c => zvs.getObject(zvs.branches.root, c))) + " = " +
				JSON.stringify(domain.map(c => zvs.getObject(zvs.branches.root, c)))
			);

			/** TODO:
			 * 		3. if result is constant we will need to remove constant from all domains
			 * 			3a. since allDomains may be incomplete, we will need to solve it after loop.
			 * 
			 * 		Also no more than 2 domains can conflict, if this happens the all merge should fail.
			*/

			if (domain.length === 0) {
				// unable to merge domains,

				console.log("[FAIL] Found conflict a and b => " + 
					JSON.stringify(zvs.getObject(branchA, a)) + " ** " +
					JSON.stringify(zvs.getObject(branchB, b))
				);

				return [];
			}

			// since domains intersect they are not different,
			// even if id is not equal for both of them, they will get 
			// removed on next found conflict.
			diffA.delete(id);
			diffB.delete(id);

		}
		else {
			console.log("No conflict for " + id);

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
	
	for (let [value, ids] of values) {
		console.log("VALUE [" + value + "] => " + JSON.stringify([...ids]));
	}

	console.log("CONFLICTS => " + JSON.stringify([...conflicts]));
	console.log("INTERSECTS => " + JSON.stringify([...intersects]));
	console.log("DIFF A.2 => " + JSON.stringify([...domainsAData]));
	console.log("DIFF B.2 => " + JSON.stringify([...domainsBData]));
	console.log("DOMAINS => " + JSON.stringify([...allDomains]));

	/**
	 * Merging diff domains are a cartasian product, since only diff domains live only on one branch: 
	 * the equal domains values must generate a new branches, so:
	 *		1. intersect all diff domains values, for equal values,
	 * 		2. generate all branch combinations where values are equal and diff,
	 * 		3. create branches.
	 * 
	 * We only consider different domains and exclude intersected domains, this is because intersected domains are garanted to be 
	 * different of all other domains, because they are in both original branches.
	 * 
	 * So intersected domains are fixed/constant to all branches combinations.
	 */

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

	console.log("Equal Domain Values " + JSON.stringify([...equals]));

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

	branches.map(({a, b}) => {
		utils.printDomains(zvs, a, "A");
		utils.printDomains(zvs, b, "B");
	});

	return branches;

//	throw "MERGE UNFINISHED!!";
	// return good_mergeDomains (zvs, branchA, branchB);
}

function good_mergeDomains (zvs, branchA, branchB) {

	const domainsA = getDomains(zvs, branchA);
	const domainsB = getDomains(zvs, branchB);

	const DOMAINS_ID = zvs.data.global("domains");

	if (domainsA && domainsB) {
		const diffA = new Set([...domainsA.all]);
		const diffB = new Set([...domainsB.all]);
		const all = new Set([...diffA, ...diffB]);
		const allDomains = new Map();

		for (const domainID of diffA) {
			const data = zvs.getData(branchA, domainID);
			const id = zvs.getData(branchA, data.id);

			allDomains.set(domainID, {
				data: zvs.getData(branchA, zvs.getData(branchA, domainID).data),
				id
			});
		}

		for (const domainID of diffB) {
			const data = zvs.getData(branchB, domainID);
			const id = zvs.getData(branchB, data.id);

			allDomains.set(domainID, {
				data: zvs.getData(branchB, zvs.getData(branchB, domainID).data),
				id
			});
		}

		const intersects = new Set();		
		for (let [id, a] of domainsA.ids) {
			const b = domainsB.ids.get(id);

			if (b) {
				diffA.delete(a);
				diffB.delete(b);

				if (a !== b) {
					// TODO:
					// 1. intersect both domains,
					// 2. if domain result is constant:
					// 	  - remove constant from all other domains,
					// 	  - repeat step 2, if any of domains result is constant,
					// 3. if result domain is empty then fail, all merge.

					const dataA = allDomains.get(a);
					const dataB = allDomains.get(b);

					const intersect = new Set([...dataA.data.filter(v => dataB.data.includes(v))]);

					if (intersect.size === 0) {
						return [];
					}
					else {						
						const domain = {
							data: [...intersect],
							id: dataA.id
						};

						// if domain has length 1, then its a constant,
						allDomains.set(a, domain);
						allDomains.set(b, domain);

						intersects.add({
							domains: {
								a,
								b
							},
							domain
						});
					}
				}
				else {
					intersects.add({
						domains: {
							a,
							b
						},
						domain: allDomains.get(a)
					});
				}
			}
		}

		/**
		 * Merging diff domains are a cartasian product, since we only support diff domains on a branch, 
		 * the equal values must generate a new branch, so:
		 *		1. intersect all diff domains values, for equal values,
		 * 		2. generate all branch combinations where values are equal and diff,
		 * 		3. create branches.
		 * 
		 * We only consider different domains and exclude intersected domains, this is because this domains are garanted to be 
		 * different of all other domains, because they are in both original branches.
		 * 
		 * So intersected domains are fixed/constant to all branches combinations.
		 */
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
						id: [domainA.id, domainB.id].sort()[0]
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

			const r = [...all].filter(v => !s.has(v));

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

				newDomains.push(domainObject);

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

					newDomains.push(domainObject);					

					zvs.branches.transform(bA, a, domainID);
					zvs.branches.transform(bB, a, domainID);

					zvs.branches.transform(bA, b, domainID);
					zvs.branches.transform(bB, b, domainID);
				}
			}

			const newDomainsID = zvs.data.add({
				type: 'domains',
				data: newDomains,
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
	else if (domainsA) {
		// create new B branch, write A domains to it.

		const domainsID = zvs.branches.getDataId(branchA, DOMAINS_ID);
		branchB = zvs.branches.getId({
			parent: branchB,
			args: [branchA, branchB],
            action: "merge-domains"
		}).branchId;

		zvs.branches.transform(branchB, DOMAINS_ID, domainsID);
	}
	else if (domainsB) {
		// create new A branch, 
		const domainsID = zvs.branches.getDataId(branchB, DOMAINS_ID);
		branchA = zvs.branches.getId({
			parent: branchA,
			args: [branchA, branchB],
            action: "merge-domains"
		}).branchId;

		zvs.branches.transform(branchA, DOMAINS_ID, domainsID);

	}

	// nothing to do,
	return [{
		a: branchA,
		b: branchB
	}];
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

				let bs = zvs.merge(
					[bA, bB],
					((a, b) => mergeDomains(zvs, a, b)),
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

		branches.push(nr);
	}
	
	session.postOffice.addActives(destination, 1);
	session.queue.put({
		action: "filterUncheckedNegations",
		data: {
			branches
		},
		destination
	});

	session.postOffice.subActives(destination, 1);
}

module.exports = merge;
