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
	const s = zvs.branches.getDomains(branchId);

	const ph = zvs.getData(branchId, zvs.getData(branchId, p).id);
	const qh = zvs.getData(branchId, zvs.getData(branchId, q).id);

	const cs = s.select([ph, qh], {
		name: "=",
		predicate: (p, q) => p === q
	});

	if (cs.count() > 0) {
		zvs.branches.setDomains(branchId, cs);
		return p;
	}
}

function constantXdomain (zvs, branchId, p, q) {
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

