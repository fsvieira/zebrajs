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
/*
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
}*/

function constantXdomain (zvs, branchId, p, q) {
	/**
	 * domain = constant, and then we remove 
	 * the constant from all other domains.
	 */
	const s = zvs.branches.getDomains(branchId);

	const h = zvs.getData(branchId, zvs.getData(branchId, q).id);

	const cs = s.select([h], {
		name: "const",
		predicate: a => a === p
	});

	if (cs.count() > 0) {
		zvs.branches.setDomains(branchId, cs);
		return p;
	}

	/*
	const DOMAINS_ID = zvs.data.global("domains");
	const domains = zvs.getData(branchId, DOMAINS_ID);
	const domainsData = zvs.getData(branchId, domains.data).map(
		v => zvs.branches.getDataId(branchId, v)
	);

	p = zvs.branches.getDataId(branchId, p);
	q = zvs.branches.getDataId(branchId, q);

	const domainsMap = new Map();

	for (let i=0; i<domainsData.length; i++) {
		const domainID = domainsData[i];
		const domain = zvs.getData(branchId, domainID);

		domainsMap.set(domainID, {
			type: "domain",
			data: zvs.getData(branchId, domain.data).slice(),
			id: zvs.getData(branchId, domain.id)
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
	// zvs.branches.transform(branchId, q, p);

	// 3. remove constant from other domains.
	// removeConstants(zvs, branchId, {domain, constant: p}, domainsMap, DOMAINS_ID);

	const remove = [p];
	const domainsConstant = new Map([[q, p]]);

	while (remove.length) {
		const c = remove.pop();

		for (let [id, domain] of domainsMap) {
			const index = domain.data.indexOf(c);

			if (index !== -1) {
				domain.data.splice(index, 1);

				if (domain.data.length === 1) {
					domainsConstant.set(id, domain.data[0]);
					domainsMap.delete(id); 

					remove.push(domain.data[0]);
				}
				else if (domain.data.length === 0) {
					return false;
				}
			}
		}
	}

	for (let [id, c] of domainsConstant) {
		zvs.branches.transform(branchId, id, c);
	}

	const newDomains = {
		type: "domains",
		data: [],
		id: [branchId]
	};

	for (let [id, domain] of domainsMap) {
		domain.data = domain.data.map(d => zvs.getObject(branchId, d));
		
		zvs.branches.transform(
			branchId,
			id,
			zvs.data.add(domain)
		); 

		newDomains.data.push(domain);
	}

	const newDomainsID = zvs.data.add(newDomains);

	zvs.branches.transform(
		branchId,
		DOMAINS_ID,
		newDomainsID
	);	

	return true;
	*/
}

function domainXconstant (zvs, branchId, p, q) {
	return constantXdomain(zvs, branchId, q, p);
}

function domainsXdomains (zvs, branchId, p, q) {
	const po = zvs.getData(branchId, p);
	const qo = zvs.getData(branchId, q);

	const pdata = (zvs.getData(branchId, po.data) || []).map(v => zvs.branches.getDataId(branchId, v));
	const qdata = (zvs.getData(branchId, qo.data) || []).map(v => zvs.branches.getDataId(branchId, v));

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
		domain: domainXdomain,
		variable: allXvariable,
		constant: domainXconstant
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
	
	if (!r || !update(zvs, branchId, p, q)) {
		// zvs.branches.end(branchId, true, "unify fail!");
		return;
	}

	return branchId;
}

module.exports = unify;

