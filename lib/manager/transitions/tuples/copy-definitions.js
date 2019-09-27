"use strict";

const prepare = require("../definitions/prepare");

function copyDefinitions (action, data, destination, session) {
	const copyTupleDefinitions = [];
	const zvs = session.zvs;
	const { branchId, tuples } = data;

	zvs.debugCheckTree(branchId);

	function uid () {
		return zvs.branches.getUniqueId(branchId);
	}

	for (let i = 0; i < tuples.length; i++) {
		const tuple = tuples[i].tuple;
		let tupleDefs;

		tupleDefs = tuples[i].definitions;

		const t = [];
		for (let j = 0; j < tupleDefs.length; j++) {
			const c = prepare.copyWithVars(
				zvs.getObject(branchId, tupleDefs[j]),
				uid
			);

			const negation = c.negation;

			delete c.negation;
			const def = zvs.data.add(c);

			t.push({
				negation: negation,
				definition: def
			});
		}

		copyTupleDefinitions.push({
			tuple,
			definitions: t
		});
	}

	zvs.debugCheckTree(branchId);
	
	session.postOffice.addActives(destination, 1);
	session.queue.put({
		action: "check",
		data: {
			branchId,
			tuples: copyTupleDefinitions
		},
		destination
	});

	session.postOffice.subActives(destination, 1);
}

module.exports = copyDefinitions;
