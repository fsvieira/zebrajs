/**
 * TODO:
 *  - Normalize domains and flops, currently domains and flops spec is fuzzy.
 * 
 * 1. Domains: Possible values (constants) one variable can take.
 * 	 a. type: 'domain',
 *   b. data: Array of constants,
 *   c. variable: an id for the original variable that was replaced by domain.
 * 
 * 2. Flop: A set of two or one domains containing failing pair of values. 
 * 	 a. type: 'flop',
 * 	 b. data: Array of objects:
 * 		* each object contains two domains:
 * 			{domainIDa: domainA, domainIDb: domainB}
 * 
 * 3. Merge flops:
 * 	 a. Multiply array of objects,
 *   b. all domainID's must match, id and variable.
 *   c. intersect both domain data, intersection can't be empty, if empty fail.
 */

const utils = require("./utils");
const Domains = require("./variables/domains");

/*
function mergeDomains (a, b) {
	const r = {};

	const ids = Object.keys({...a, ...b});

	for (let i=0; i<ids.length; i++) {
	 	const n = ids[i];
	// for (let n in a) {
		let ra = a[n];
		let rb = b[n];

		ra = ra || rb;
		rb = rb || ra;

		const d = {type: 'domain', data: ra.data.filter(n => {
			// TODO: optimize this by extracting constant values to an tmp array.
			for (let j=0; j<rb.data.length; j++) {
				if (rb.data[j].data === n.data) {
					return true;
				}
			}

			return false;
		}), variable: ra.variable};

		if (d.data.length) {
			r[n] = d;
		}
		else {
			// can't merge domain, its not possible to find a common failing state.
			return;
		}
	}

	return r;
}

function multiplyFlop (a, b) {

	if (a) {
		const domains = [];
		for (let i=0; i<a.length; i++) {
			const domainA = a[i];
			
			for (let j=0; j<b.length; j++) {
				const domainB = b[j];
				const r = mergeDomains(domainA, domainB);
	
				if (r) {
					domains.push(r);
				}
			}	
		}

		return domains;
	}
	else {
		return b;
	}
}
*/
function getFlop (flop, zvs, branchId, domains) {
	if (!domains.isEmpty()) {
		const DOMAINS = zvs.data.global("domains");
		const nDomains = Domains.fromJSON(zvs, zvs.getObject(branchId, DOMAINS));

		// remove all variables that are not on original domain,
		const remove = [];
		for (let i=0; i<nDomains.variables.length; i++) {
			const v = nDomains.variables[i];

			if (!domains.variables.includes(v)) {
				remove.push(v);
			}
		}

		remove.forEach(r => nDomains.remove(v));

		// check for variables not in nDomains,
		for (let i=0; i<domains.variables.length; i++) {
			const v = domains.variables[i];

			if (!nDomains.variables.includes(v)) {
				const id = zvs.branches.getDataId(branchId, v);
				/**
				 * If original variable is not on domain then it must be:
				 * 	- A unify to other original domain variable (equal),
				 *  - A constant.
				 */
				if (nDomains.variables.includes(id)) {
					nDomains.equalShift(v, id);
				}
				else {
					// constant
					nDomains.shift(i, new Set([id]));
					nDomains.variables.push(v);
					nDomains.variables.sort();
				}
			}
		}

		const s = domains.subtract(nDomains);

		flop = flop?flop.intersect(s):s;

		return flop.isEmpty()?undefined:flop;
	}

}

module.exports = {
// 	multiplyFlop,
	getFlop
};
