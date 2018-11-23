const utils = require("./utils");
const Domains = require("./variables/domains");

function getFlop (flop, zvs, branchId, domains) {
	if (!domains.isEmpty()) {
		const DOMAINS = zvs.data.global("domains");
		const nDomains = Domains.fromJSON(zvs, zvs.getObject(branchId, DOMAINS));

		// 1. inject values on domain,
		for (let i=0; i<domains.variables.length; i++) {
			const v = domains.variables[i];
			const data = zvs.branches.getDataId(branchId, v);

			if (nDomains.variables.includes(data)) {
				if (v !== data) {
					nDomains.equalShift(v, data);
				}
			}
			else {
				// its a constant,
				nDomains.shift(i, new Set([data]), v);
			}
		}

		// 2. remove all nDomain variables that are not on domain,
		for (let i=nDomains.variables.length-1; i>=0; i--) {
			const v = nDomains.variables[i];

			if (!domains.variables.includes(v)) {
				nDomains.remove(v);
			}
		}

		const s = domains.subtract(nDomains);
		flop = flop?flop.intersect(s):s;

		return flop.isEmpty()?undefined:flop;
	}
}

module.exports = {
	getFlop
};
