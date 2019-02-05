"use strict";

const utils = require("../../../utils");

function filterExistsUndef (zvs, branchId) {
	return n => zvs.getData(
		branchId,
		zvs.getData(branchId, n).exists
	) === undefined;
}

function filterUncheckedNegations (action, data, destination, session) {
	let { branches, branchId } = data;
	const zvs = session.zvs;

	branches = branches || [
		[branchId]
	];

	const results = {
		branches,
		negations: [],
		branchId
	};

	const queryId = zvs.data.global("query");

	for (let i = 0; i < branches.length; i++) {
		const bs = branches[i];

		for (let j = 0; j < bs.length; j++) {
			const branchId = bs[j];

			let nots = zvs.getData(
				branchId,
				zvs.getData(branchId, queryId).negation
			);

			if (nots) {
				nots = nots.filter(filterExistsUndef(zvs, branchId));
			}

			if (nots && nots.length) {
				results.negations.push({
					branchId,
					negations: nots,
					branches: bs
				});
			}
		}
	}

	session.postOffice.addActives(destination, 1);
	session.queue.put({
		action: "negations", 
		data: results,
		destination
	});

	session.postOffice.subActives(destination, 1);

}

module.exports = filterUncheckedNegations;
