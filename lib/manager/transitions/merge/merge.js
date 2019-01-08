"use strict";

const actionUnify = require("../tuples/actionUnify");
const utils = require("../../../utils");
const Domains = require("../../../variables/domains");
const combinations = require("../../../variables/combinations");

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

		// console.log("RESULT => " + nr.length);

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

function getDomains (zvs, branch) {
	const domains = zvs.getData(branch, zvs.data.global("domains"));
	const domainsData = zvs.getData(branch, domains.data);

	if (domainsData) {
		const ids = new Map();
		const all = new Set(domainsData);

		for (let i=0; i<domainsData.length; i++) {
			const d = zvs.branches.getDataId(branch, domainsData[i]);
			const data = zvs.getData(branch, d);
			const id = zvs.getData(branch, data.id);

			ids.set(id, d);
		}

		return {
			ids,
			all
		};
	}
}

function mergeDomains (zvs, branchA, branchB) {

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

		for (let [id, a] of domainsA.ids) {
			const b = domainsB.ids.get(id);
			if (b) {
				console.log("ID " + id + " instersect " + a + ", " + b);
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

					const intersect = new Set([...dataA].filter(v => dataB.has(v)));

					if (intersect.size === 1) {
						// domain is constant,
						console.log("Domain is constant");
					}
					else {
						console.log("Intersect size = " + intersect.size + "; a=" + dataA.size + ", b=" + dataB.size);
					}
				}
			}
		}

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
		).map(v => {
			const s = new Set(v.reduce((acc, v) => acc.concat([v.domains.a, v.domains.b]), []));

			console.log(JSON.stringify([...all]));

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

		console.log("EQUALS ==> " + JSON.stringify([...e]));

		const branches = [];
		for (let i=0; i<e.length; i++) {
			const domains = e[i];

			console.log("Create Branch => " + JSON.stringify(domains));

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

			for (let i=0; i<domains.length; i++) {
				const d = domains[i];

				const domainID = zvs.data.add({
					type: "domain",
					data: d.values.map(id => zvs.getObject(zvs.branches.root, id)),
					id: d.id
				});

				zvs.branches.transform(bA, d.domains.a, domainID);
				zvs.branches.transform(bB, d.domains.a, domainID);

				if (d.domains.b) {
					zvs.branches.transform(bA, d.domains.b, domainID);
					zvs.branches.transform(bB, d.domains.b, domainID);
				}
			}

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
		const domainsID = zvs.branches.getDataId(branchA, DOMAINS_ID);
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
	const DOMAINS_ID = zvs.data.global("domains");

	while (branches.length > 1) {
		branches.sort((a, b) => b.length - a.length);

		const a = branches.pop();
		const b = branches.pop();

		let nr = [];

		for (let i = 0; i < a.length; i++) {
			const bA = a[i];

			for (let j = 0; j < b.length; j++) {
				let bB = b[j];

				const domainBranches = mergeDomains(zvs, bA, bB);

				for (let i=0; i<domainBranches.length; i++) {
					const d = domainBranches[i];

					let bs = zvs.merge(
						[d.a, d.b],
						actionUnify,
						"unify&merge"
					);
					
					if (bs && bs.length) {
						nr = nr.concat(bs);
					}
				}
			}
		}

		// console.log("RESULT => " + nr.length);

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
