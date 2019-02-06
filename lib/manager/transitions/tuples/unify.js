"use strict";

const prepare = require("../definitions/prepare");
const utils = require("../../../utils");

function tupleXtuple (zvs, branchId, p, q) {
	const po = zvs.getData(branchId, p);
	const qo = zvs.getData(branchId, q);

	const pData = zvs.getData(branchId, po.data);
	const qData = zvs.getData(branchId, qo.data);

	if (pData.length === qData.length) {
		for (let i = 0; i < pData.length; i++) {
			if (!unify(zvs, branchId, pData[i], qData[i])) {
				return;
			}
		}

		return true;
	}

}

function variableXall (zvs, branchId, p, q) {
	zvs.branches.transform(branchId, p, q);
	return true;
}

function allXvariable (zvs, branchId, p, q) {
	zvs.branches.transform(branchId, q, p);
	return true;
}

function domainXdomain (zvs, branchId, p, q) {

	const po = zvs.getData(branchId, p);
	const qo = zvs.getData(branchId, q);

	// 1. check if this is a merge phase.
	if (po.merge && qo.merge) {
		const pMerge = new Map(zvs.getObject(branchId, po.merge));
		const qMerge = new Map(zvs.getObject(branchId, qo.merge));

		const mergeIDs = new Set([...pMerge.keys(), ...qMerge.keys()]);

		// 2. make union of two merges,
		const merge = new Map();
		for (let id of mergeIDs) {
			const a = pMerge.get(id);
			const b = qMerge.get(id);

			if (a && b && a !== b) {
				// 2a. there is an inconsistency and 
				//     the two domains can't be merged. 
				return false;
			}
			else if (a) {
				merge.set(id, a);
			}
			else if (b) {
				merge.set(id, b);
			}
		}

		// 3. domains can be merged, intersect both domains values.
		const pData = zvs.getData(branchId, po.data);
		const qData = zvs.getData(branchId, qo.data);

		const data = pData.filter(c => qData.includes(c));

		const pID = zvs.getData(branchId, po.id);
		const qID = zvs.getData(branchId, qo.id);

		const domain = {
			type: "domain",
			data: data.map(c => zvs.getObject(branchId, c)),
			merge: [...merge],
			id: [pID, qID].sort()[0]
		};

		// 4. check domain result,
		if (data.length === 1) {
			// 4a. domain is a constant.
			const constant = data[0];

			// 5. prepare domains,
			const DOMAINS_ID = zvs.data.global("domains");
			const domains = zvs.getData(branchId, DOMAINS_ID);
			const domainsData = zvs.getData(branchId, domains.data);
		
			const domainsMap = new Map();
			for (let i=0; i<domainsData.length; i++) {
				const domainID = domainsData[i];

				if (domainID !== p && domainID !== q) {
					const domain = zvs.getData(branchId, domainID);
			
					domainsMap.set(domainID, {
						data: zvs.getData(branchId, domain.data).slice(),
						id: zvs.getData(branchId, domain.id),
						merge: domain.merge?new Map(zvs.getObject(branchId, domain.merge)):undefined
					});
				}
			}

			// 6. make domains equal to constant.
			zvs.branches.transform(branchId, p, constant);
			zvs.branches.transform(branchId, q, constant);

			// 7. remove constant from other domains.
			removeConstants(zvs, branchId, {domain, constant}, domainsMap, DOMAINS_ID);
		}
		else if (data.length === 0) {
			// 4b. result domain is empty, can't be merged.
			return false;
		}
		else {
			const domainID = zvs.data.add(domain);

			zvs.branches.transform(branchId, p, domainID);
			zvs.branches.transform(branchId, q, domainID);
		}

		return true;
	}

	return false;
}

/**
* Aux functions,
*/
function checkDomainMerge (a, b) {
	if (a && b) {
		for (let aID of a.keys()) {
			if (b.has(aID)) {
				return true;
			}			
		}
	}

	return true;
}

function removeConstants (zvs, branchId, constant, domainsMap, DOMAINS_ID) {
	const remove = new Set([constant]);

	for (let e of remove) {
		for (let [id, d] of domainsMap) {
			if (checkDomainMerge(e.domain.merge, d.merge)) {
				const index = d.data.indexOf(e.constant);
				if (index !== -1) {
					d.data.splice(index, 1);

					if (d.data.length === 1) {
						// domain is a constant:
						// 1. remove it from domains,
						domainsMap.delete(id);

						// 2. add constant to be removed from other domains,
						const constant = d.data[0];

						remove.add({
							domain: d,
							constant
						});

						// 3. update domain as constant.
						zvs.branches.transform(branchId, id, constant);
					}
				}
			}
		}
	}

	const newDomains = {
		type: "domains",
		data: [],
		id: [branchId]
	};

	for (let [id, d] of domainsMap) {
		newDomains.data.push({
			type: "domain",
			data: d.data.map(c => zvs.getObject(branchId, c)),
			id: d.id,
			merge: d.merge?[...d.merge]:undefined
		});
	}

	const newDomainsID = zvs.data.add(newDomains);

	zvs.branches.transform(
		branchId,
		DOMAINS_ID,
		newDomainsID
	);	
}

function constantXdomain (zvs, branchId, p, q) {
	/**
	 * Merge Case:
	 * 	- On normal case we make domain = constant, and then we remove 
	 * the constant from all other domains.
	 * 
	 * 	- On merge case the information may be incomplete, since global domains may not 
	 *  have been merged yet. Even if we garantee domains merge before anything else, 
	 *  individual domains may also not be updated.
	 * 
	 * - Lets consider that all domains have been merged on merged branch:
	 * 		- the constant should only modify domains that include at least on mergeID present on changed domain, with make it a recursive operation.
	 * 		- at the end all domains should be consistent with constant.
	 * 
	 * - Lets consider that not all domains have been merged on merged branch:
	 * 		- the constant will not be removed from missing domains,
	 * 		- but it will be removed on next conflict merge, when domain conflicts again with constant?
	 * 
	 * - because of mergeID, all domains should be in conflict and not updated for unify, we should handle this better.
	 * 
	 * - what happens to conflicts ?
	 * 		- the merge branch gets incomplet, however missing ids can still have valid values from root, that in case of conflict 
	 * 		will be solved on next merge.
	 */

	const DOMAINS_ID = zvs.data.global("domains");
	const domains = zvs.getData(branchId, DOMAINS_ID);
	const domainsData = zvs.getData(branchId, domains.data).map(
		v => zvs.branches.getDataId(branchId, v)
	);

	p = zvs.branches.getDataId(branchId, p);
	q = zvs.branches.getDataId(branchId, q);


	if (!domainsData.includes(q)) {
		domainsData.push(q);
	}

	const domainsMap = new Map();
	for (let i=0; i<domainsData.length; i++) {
		const domainID = domainsData[i];
		const domain = zvs.getData(branchId, domainID);

		// There is two repeated domains,
		domainsMap.set(domainID, {
			data: zvs.getData(branchId, domain.data).slice(),
			id: zvs.getData(branchId, domain.id),
			merge: domain.merge?new Map(zvs.getObject(branchId, domain.merge)):undefined
		});
	}

	const domain = domainsMap.get(q);

	if (!domain.data.includes(p)) {
		// if constant is not in domain than fail.
		return false;
	}

	// 1. remove domain from map.
	domainsMap.delete(q);

	// 2. make domain equal to constant.
	zvs.branches.transform(branchId, q, p);

	// 3. remove constant from other domains.
	removeConstants(zvs, branchId, {domain, constant: p}, domainsMap, DOMAINS_ID);

	return true;
}

function domainXconstant (zvs, branchId, p, q) {
	return constantXdomain(zvs, branchId, q, p);
}

function domainsXdomains (zvs, branchId, p, q) {
	const po = zvs.getData(branchId, p);
	const qo = zvs.getData(branchId, q);

	const pdata = zvs.getData(branchId, po.data) || [];
	const qdata = zvs.getData(branchId, qo.data) || [];

	const domains = [...new Set([...pdata, ...qdata])];

	const domainsObject = {
		type: "domains",
		// don't allow anything that is not domains,
		data: domains.map(d => zvs.getObject(branchId, d)).filter(v => v.type === 'domain'),
		id: branchId
	};
	
	const domainsID = zvs.data.add(domainsObject);
	
	zvs.branches.transform(branchId, p, domainsID);
	zvs.branches.transform(branchId, q, domainsID);

	return true;
}

const table = {
	tuple: {
		tuple: tupleXtuple,
		variable: allXvariable
	},
	variable: {
		tuple: variableXall,
		variable: variableXall,
		constant: variableXall,
		domain: variableXall
	},
	constant: {
		variable: allXvariable,
		domain: constantXdomain
	},
	domain: {
		domain: domainXdomain, // make both variables equal,
		variable: allXvariable, // just point variable to domain.
		constant: domainXconstant // remove all constant from domain/var, remove var from domain.
	},
	domains: {
		domains: domainsXdomains
	}
};

function update (zvs, branchId, p, q) {
	let po = zvs.getData(branchId, p);
	let qo = zvs.getData(branchId, q);

	let updateData = {
		check: zvs.getData(branchId, po.check) ||
			zvs.getData(branchId, qo.check)
	};

	let doUpdate = updateData.check;
	let ns = prepare.union(
		zvs,
		branchId,
		zvs.getData(branchId, po.negation) || [],
		zvs.getData(branchId, qo.negation) || []
	);

	if (ns && ns.length > 0) {
		updateData.negation = ns;
		doUpdate = true;
	}

	if (doUpdate) {
		zvs.update(branchId, p, updateData);
		zvs.update(branchId, q, updateData);
	}

	return true;
}

function unify (zvs, branchId, p, q, evalNegation) {
	p = zvs.branches.getDataId(branchId, p);
	q = zvs.branches.getDataId(branchId, q);

	let po = zvs.getData(branchId, p);
	let qo = zvs.getData(branchId, q);
	let r = true;

	// utils.printQuery(zvs, branchId, "UNIFY START");
/*
	console.log(
		JSON.stringify(zvs.getObject(branchId, p)) + " ** " +
		JSON.stringify(zvs.getObject(branchId, q))
	);

	console.log(
		utils.toString(zvs.getObject(branchId, p)) + " ** " +
		utils.toString(zvs.getObject(branchId, q)) + "\n"
	);
*/
	if (p !== q) {
		let pt = zvs.getData(branchId, po.type);
		let qt = zvs.getData(branchId, qo.type);

		if (table[pt] && table[pt][qt]) {
			r = table[pt][qt](zvs, branchId, p, q, evalNegation);
		}
		else {			
			r = false;
		}
	}

	// utils.printQuery(zvs, branchId, "UNIFY UPDATE");

	if (!r || !update(zvs, branchId, p, q)) {
		// zvs.branches.end(branchId, true, "unify fail!");	
		/*console.log(
			utils.toString(zvs.getObject(branchId, p)) + " ** " +
			utils.toString(zvs.getObject(branchId, q)) + " ==> FAIL"
		);

		console.log(
			JSON.stringify(zvs.getObject(branchId, p)) + " ** " +
			JSON.stringify(zvs.getObject(branchId, q)) + " ==> FAIL"
		);*/
		return;
	}

	// console.log("OK");
	// utils.printDomains(zvs, branchId, "DOMAINS");

	return branchId;
}

module.exports = unify;
