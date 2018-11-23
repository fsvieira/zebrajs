"use strict";

const prepare = require("../definitions/prepare");
const utils = require("../../../utils");
const Domains = require("../../../variables/domains");

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

	// 1. get global domain,
	const DOMAINS = zvs.data.global("domains");
	const jsonDomain = zvs.getObject(branchId, DOMAINS);
	
	// 2. construct domain,
	const domains = Domains.fromJSON(zvs, jsonDomain);
	
	// 3. p = q.
	const v = domains.equal(p, q);
	
	if (domains.isEmpty()) {
		// domain can't be empty.
		return false;
	}

	// TODO: 3a. Check if result is only one constant and if it is, then unify with variables.
	// console.log("TODO (UNIFY): 3a. Check if result is only one constant and if it is, then unify with variables.");

	// 3a. Check if result is only one constant and if it is, then unify with variables.
	const symbols = domains.getVariableSymbols(v);

	if (symbols.size === 1) {
		const c = symbols.values().next().value;
		zvs.branches.transform(branchId, p, c);
		zvs.branches.transform(branchId, q, c);
	}
	else {
		// 4. save domain changes.
		const d = zvs.data.add(domains.toJSON());
		zvs.branches.transform(branchId, DOMAINS, d);
		
		// 5. make domains equal.
		zvs.branches.transform(branchId, p, q);
	}

	return true;
}

function constantXdomain (zvs, branchId, p, q) {
	// 1. get global domain,
	const DOMAINS = zvs.data.global("domains");
	const jsonDomain = zvs.getObject(branchId, DOMAINS);

	// 2. construct domain,
	const domains = Domains.fromJSON(zvs, jsonDomain);

	// 3. q variable is equal to symbol p.
	const r = domains.equalSymbol(q, p);

	if (!r) {
		// domain can't be empty.
		return false;
	}

	// 4. check if other variables have only one constant,
	for (let i=domains.variables.length-1; i>=0; i--) {
		const v = domains.variables[i];
		const symbols = domains.getVariableSymbols(v);
		
		if (symbols.size === 1) {
			// make variable equal to symbol,
			const c = symbols.values().next().value;
			domains.equalSymbol(v, c);
			zvs.branches.transform(branchId, v, c);
		}
	}

	const dJSON = domains.toJSON();

	if (domains.isEmpty()) {
		dJSON.branchId = branchId;
	}

	// 5. save domain changes.
	const d = zvs.data.add(dJSON);
	zvs.branches.transform(branchId, DOMAINS, d);

	// 6. change domain to constant
	zvs.branches.transform(branchId, q, p);

	return true;
}

function domainXconstant (zvs, branchId, p, q) {
	return constantXdomain(zvs, branchId, q, p);
}

function domainsXdomains (zvs, branchId, p, q) {
	const po = zvs.getObject(branchId, p);
	const qo = zvs.getObject(branchId, q);

	if (po.data && qo.data) {
		
		if (po.branchId) {
			zvs.branches.transform(branchId, p, q);
		}
		else if (qo.branchId) {
			zvs.branches.transform(branchId, q, p);
		}
		else {
			const pd = Domains.fromJSON(zvs, po);
			const qd = Domains.fromJSON(zvs, qo);

			const r = pd.merge(qd);

			if (r.isEmpty()) {
				return false;
			}

			const rJSON = r.toJSON();
			
			if (r.isEmpty()) {
				rJSON.branchId = branchId;
			}

			const d = zvs.data.add(rJSON);

			zvs.branches.transform(branchId, p, d);
			zvs.branches.transform(branchId, q, d);
		}
		
	}
	else if (po.branchId) {
		zvs.branches.transform(branchId, q, p);
	}
	else if (qo.branchId) {
		zvs.branches.transform(branchId, p, q);
	}

	return true;
}

const table = {
	"tuple": {
		"tuple": tupleXtuple,
		"variable": allXvariable
	},
	"variable": {
		"tuple": variableXall,
		"variable": variableXall,
		"constant": variableXall,
		"domain": variableXall
	},
	"constant": {
		"variable": allXvariable,
		"domain": constantXdomain
	},
	"domain": {
		"domain": domainXdomain, // make both variables equal,
		"variable": allXvariable, // just point variable to domain.
		"constant": domainXconstant // remove all constant from domain/var, remove var from domain.
	},
	// Merge global domains object.
	// it only merges with domains,
	// but domain may not be set (check for data).
	"domains": {
		"domains": domainsXdomains
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
		);*/

		return;
	}

	// console.log("OK");

	// utils.printQuery(zvs, branchId, "UNIFY END");
	return branchId;
}

module.exports = unify;
