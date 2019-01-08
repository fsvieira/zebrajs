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
	return false;
}

function constantXdomain (zvs, branchId, p, q) {
	const DOMAINS_ID = zvs.data.global("domains");
	const domains = zvs.getData(branchId, DOMAINS_ID);
	const domainsData = zvs.getData(branchId, domains.data).slice();

	domainsData.splice(domainsData.indexOf(q), 1);
	zvs.branches.transform(branchId, q, p);

	const remove = new Set([p]);

	for (let e of remove) {
		for (let i=0; i<domainsData.length; i++) {
			const id = domainsData[i];
			const domain = zvs.getData(branchId, id);
			const data = zvs.getData(branchId, domain.data).slice();

			const index = data.indexOf(e);
			if (index !== -1) {
				data.splice(index, 1);

				if (data.length === 1) {
					zvs.branches.transform(branchId, id, data[0]);
					domainsData.splice(i, 1);
					remove.add(data[0]);
				}
				else if (data.length === 0) {
					// no possible values available.
					return false;
				}
				else {
					zvs.update(branchId, id, {
						data: data.map(v => zvs.getObject(branchId, v))
					});
				}

			}
		}
	}

	zvs.update(
		branchId,
		DOMAINS_ID,
		{
			data: domainsData.map(v => zvs.getObject(branchId, v))
		}
	);

	return true;
}

function domainXconstant (zvs, branchId, p, q) {
	return constantXdomain(zvs, branchId, q, p);
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
		/*
		console.log(
			utils.toString(zvs.getObject(branchId, p)) + " ** " +
			utils.toString(zvs.getObject(branchId, q)) + " ==> FAIL"
		);*/
		console.log(
			JSON.stringify(zvs.getObject(branchId, p)) + " ** " +
			JSON.stringify(zvs.getObject(branchId, q)) + " ==> FAIL"
		);
		return;
	}

	// console.log("OK");

	// utils.printQuery(zvs, branchId, "UNIFY END");
	return branchId;
}

module.exports = unify;
