"use strict";

const ZVS = require("../../../zvs/zvs");
const prepare = require("./prepare");
const { actionUnify } = require("../tuples");

function multiplyRecursive (zvs, definitions) {
	if (definitions.length > 1) {
		const results = [definitions.shift()];

		for (let i = 0; i < definitions.length; i++) {
			// d * r
			const d = definitions[i];

			for (let j = 0; j < results.length; j++) {
				const r = results[j];
				const result = actionUnify(
					zvs, { branchId: zvs.branches.root, args: [d, r] }
				);

				if (result !== undefined) {
					const id = zvs.getUpdatedId(result, d);

					if (id !== undefined && results.indexOf(id) === -1) {
						results.push(id);
					}
				}
			}
		}

		const r = multiplyRecursive(zvs, definitions);

		r.forEach(d => {
			if (results.indexOf(d) === -1) {
				results.push(d);
			}
		});

		return results;
	}

	return definitions;
}

function multiply (definitions) {
	const zvs = new ZVS();

	definitions = prepare.definitions(definitions);

	const r = multiplyRecursive(zvs, definitions.map(d => zvs.data.add(d)));
	const results = r.map(d => zvs.getObject(zvs.branches.root, d));

	return prepare.definitions(results);
}

function multiplyDefinitions (action, data, destination, session) {
	const { query, definitions } = data;

	// TODO: make sure that definitions don't change, and copy is made.
	session.postOffice.addActives(destination, 1);

	session.queue.put({
		action: "checkMultiplyDefinitions",
		data: {
			query, 
			definitions: multiply(definitions) 
		},
		destination
	});

	session.postOffice.subActives(destination, 1);
}

module.exports = multiplyDefinitions;
