"use strict";

const actionUnify = require("./actionUnify");
const utils = require("../../../utils");
const {getVariables} = require("../../utils");

// function getVariablesAndDomains (zvs, branchId, tupleId) {

function check (action, data, destination, session) {
	const zvs = session.zvs;
	const { branchId, tuples: mergeTuples } = data;
	const queryId = zvs.data.global("query");
	const merge = [];

	utils.printQuery(zvs, branchId, "Check");

	for (let i = 0; i < mergeTuples.length; i++) {
		const { tuple, definitions } = mergeTuples[i];
		const r = [];

		for (let j = 0; j < definitions.length; j++) {
			const { negation, definition } = definitions[j];

			const unifyBranchId = actionUnify(
				zvs, { branchId, args: [tuple, definition] }
			);

			if (unifyBranchId) {
				if (negation && negation.length > 0) {
					const query = Object.assign({},
						zvs.getData(unifyBranchId, queryId)
					);

					const qnegation = zvs.getData(
						unifyBranchId,
						query.negation
					).slice(0);

					for (let n = 0; n < negation.length; n++) {
						const nId = zvs.data.add(negation[n]);

						if (qnegation.indexOf(nId) === -1) {
							qnegation.push(nId);
						}
					}

					query.negation = zvs.data.getId(qnegation.sort());
					zvs.branches.transform(
						unifyBranchId,
						queryId,
						zvs.data.getId(query)
					);
				}

				r.push(unifyBranchId);
			}
		}

		if (r.length > 0) {
			merge.push({
				branches: r,
				variables: getVariables(zvs, branchId, tuple),
				// ...getVariablesAndDomains(zvs, branchId, tuple),
				tupleId: tuple
			});
		}
		else {
			// branch fails,
			// TODO: we need to mark branch as fail.
			session.postOffice.subActives(destination, 1);
			return;
		}
	}
	
	// TODO: should we pass original branchId,
	session.postOffice.addActives(destination, 1);

	session.queue.put({
		action: "domains",
		data: { 
			branches: merge, 
			branchId 
		},
		destination
	});

	session.postOffice.subActives(destination, 1);
}

module.exports = check;
