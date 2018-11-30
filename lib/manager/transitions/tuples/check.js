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
	
	const QUERY_VARIABLES = zvs.data.global("variables");
	const queryVariables = zvs.getObject(branchId, QUERY_VARIABLES);

	console.log("V => " + JSON.stringify(queryVariables.data));

	utils.printQuery(zvs, branchId, "CHECK!!");
	
	for (let i = 0; i < mergeTuples.length; i++) {
		const { tuple, definitions } = mergeTuples[i];
		const r = [];

		for (let j = 0; j < definitions.length; j++) {
			const { negation, definition } = definitions[j];

			const dVars = getVariables(zvs, branchId, definition).map(v => zvs.getObject(branchId, v));

			let defBranchId = branchId;
			if (dVars.length) {
				// create a new branch to store definitions variables,

				const qvs = queryVariables.data.concat(dVars);
				qvs.sort((a, b) => a.id.localeCompare(b.id));

				const varsID = zvs.data.add({type: "variables", data: qvs});
	
				defBranchId = zvs.branches.getId({
					parent: branchId,
					args: [definition],
					action: "add-variables"
				}).branchId;
				
				zvs.branches.transform(defBranchId, QUERY_VARIABLES, varsID);
			}

			const unifyBranchId = actionUnify(
				zvs, { branchId: defBranchId, args: [tuple, definition] }
			);

			if (unifyBranchId) {
				if (negation && negation.length > 0) {
					console.log("TODO (check.js): NEGATIONS");

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
