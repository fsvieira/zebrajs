"use strict";

const utils = require("../../../utils");
const {
	prepare
} = require("../definitions");

const Table = require("../../domains/table");

function filterExistsUndef (zvs, branchId) {
	return n => zvs.getData(
		branchId,
		zvs.getData(branchId, n).exists
	) === undefined;
}

function hasUncheckedTuples (zvs, branchId) {
	const tupleId = zvs.branches.getDataId(branchId, zvs.data.global("query"));
	const tuples = [tupleId];
	const all = [tupleId];

	while (tuples.length > 0) {
		const tupleId = tuples.pop();

		const tuple = zvs.getData(branchId, tupleId);
		const data = zvs.getData(branchId, tuple.data);
		const check = zvs.getData(branchId, tuple.check);

		if (!check) {
			return true;
		}

		for (let i = 0; i < data.length; i++) {
			const id = zvs.branches.getDataId(branchId, data[i]);
			const v = zvs.getData(branchId, id);
			const type = zvs.getData(branchId, v.type);

			if (type === "tuple" && !all.includes(id)) {
				tuples.push(id);
				all.push(id);
			}
		}
	}

	return false;
}

function canEval (zvs, branchId, tupleId, queryVariables) {
	const negationVariables = getVariables(zvs, branchId, tupleId, true);
	
	for (let i = 0; i < negationVariables.length; i++) {
		const v = negationVariables[i];

		if (queryVariables.includes(v)) {
			return !hasUncheckedTuples(zvs, branchId);
		}
	}

	return true;
}

function getVariables (zvs, branchId, tupleId, processNegations) {
	tupleId = tupleId === undefined ?
		zvs.branches.getDataId(branchId, zvs.data.global("query")) : tupleId;

	const vars = [];

	const tuples = [tupleId];
	const all = [tupleId];

	while (tuples.length > 0) {
		const tupleId = tuples.pop();

		const tuple = zvs.getData(branchId, tupleId);
		const data = zvs.getData(branchId, tuple.data);

		for (let i = 0; i < data.length; i++) {
			const id = zvs.branches.getDataId(branchId, data[i]);
			const v = zvs.getData(branchId, id);
			const type = zvs.getData(branchId, v.type);

			if (type === "variable") {
				if (vars.indexOf(id) === -1) {
					vars.push(id);
				}
			}
			else if (type === "tuple" && all.indexOf(id) === -1) {
				tuples.push(id);
				all.push(id);
			}
		}

		if (processNegations) {
			const negations = zvs.getData(
				branchId,
				zvs.getData(branchId, tupleId).negation
			);

			if (negations && negations.length > 0) {
				for (let n = 0; n < negations.length; n++) {
					const tupleId = zvs.branches.getDataId(
						branchId,
						negations[n]
					);

					if (all.indexOf(tupleId) === -1) {
						all.push(tupleId);
						tuples.push(tupleId);
					}
				}
			}
		}
	}

	return vars;
}

async function evalNegation (session, branchId, tupleId) {
	const zvs = session.zvs;
	const neg = session.zvs.getObject(branchId, tupleId);
	const DOMAINS_ID = session.zvs.data.global("domains");

	const nQueryId = session.zvs.data.add(
		prepare.query(neg)
	);

	const definitionsBranchId = session.zvs.getData(
		branchId,
		session.zvs.getData(
			branchId,
			session.zvs.getData(
				branchId,
				session.zvs.data.global("definitions")
			).data
		).branchId
	);

	const { branchId: queryBranchId} = session.zvs.branches.getId({
		parent: definitionsBranchId,
		// TODO: args: [nQueryId]
		// -- we need to check:
		//  1. if branch alredy exists (flag returned from getId, values: true/false),
		//  2. if tuple exists (saved on query tuple, values: true/false/undefined)
		//  3. if tuple exists throw exception, else get results.
		args: [nQueryId, branchId],
		action: "query"
	});

	session.zvs.branches.transform(
		queryBranchId,
		session.zvs.data.global("queryBranchId"),
		session.zvs.data.add({
			type: "query",
			data: queryBranchId
		})
	);

	/**
	 * TODO: 
	 * 		- we should only include tuple domains.
	 */
	session.zvs.branches.transform(
		queryBranchId,
		DOMAINS_ID,
		session.zvs.branches.getDataId(branchId, DOMAINS_ID)
	);

	session.zvs.branches.transform(
		queryBranchId,
		session.zvs.data.global("query"),
		nQueryId
	);

	const destination = await session.postOffice.register(
		session.username, 
		"Internal Query " + queryBranchId
	);

	session.postOffice.addActives(destination, 1);
	session.queue.put({
		action: "filterUncheckedTuples",
		data: queryBranchId,
		destination
	});


	const data = await session.postOffice.pull(destination);
	await session.postOffice.remove(destination);

	let flop;

	if (data.length) {
		// 1. get original branch domains,
		const domains = zvs.getData(branchId, DOMAINS_ID);

		// TODO: repeated header, why ??
		const h = zvs.getData(branchId, domains.data);

		if (h) {
			// TODO: domains are getting duplicated entries, with diferent ids, meaning they are not updated and removed when duplicated.
			const header = [...new Set(h.map(id => zvs.branches.getDataId(branchId, id)))];

			// 2. get original domains,
			const ot = new Table(header);
			const originalDomains = header.map(id => [id, zvs.getData(branchId, zvs.getData(branchId, id).data)]);
			
			ot.addENERow(originalDomains);

			// 3. get negated domains set,
			// 3a. create a table,
			const nt = new Table(header);

			for (let i=0; i<data.length; i++) {
				const b = data[i];

				const domains = header.map(id => {
					const vID = zvs.branches.getDataId(b, id);
					const data = zvs.getData(b, vID);
					const type = zvs.getData(b, data.type);

					if (type === 'constant') {
						return [id, vID]
					}
					else {
						return [id, zvs.getData(b, data.data)]
					}
				});

				nt.addENERow(domains);
			}

			const t = ot.symmetricDifference(nt);

			if (!t.isEmpty()) {
				flop = t;
			}
			else {
				session.zvs.update(branchId, tupleId, { exists: true });
				throw "Query exists";
			}
		}
		else {
			// we are unable to fail all branches,
			session.zvs.update(branchId, tupleId, { exists: true });
			throw "Query exists";
		}
	}

	session.zvs.update(
		branchId,
		tupleId,
		{ exists: false }
	);

	//	"Query does not exist!!";
	return flop;
}

async function evalNegations (session, branchId, nots) {
	// 1. check witch nots can be eval,
	// 2. eval nots,
	// 3. ...

	const {zvs} = session;

	try {
		const queryVariables = getVariables(zvs, branchId);

		// const negations = [];

		let flop;
		for (let i=0; i<nots.length; i++) {
			const tupleId = nots[i];

			if (canEval(zvs, branchId, tupleId, queryVariables)) {
				// negations.push(evalNegation(session, branchId, tupleId));
				const en = await evalNegation(session, branchId, tupleId);

				if (en) {
					flop = flop?flop.intersect(en):en;

					if (flop.isEmpty()) {
						return;
					}
				}
			}
		}

		if (flop) {
			const count = flop.s.count(); 
			if (!count) {
				return;
			}
			else {
				const ene = flop.toENE();
				const flopBranches = [];

				const DOMAINS_ID = zvs.data.global("domains");

				for (let i=0; i<ene.solution.length; i++) {
					const es = ene.solution[i];

					const { branchId: newBranchId} = session.zvs.branches.getId({
						parent: branchId,
						args: [i],
						action: "flop"
					});
				
					flopBranches.push(newBranchId);

					const domains = new Map(es.domains);
					const branchDomains = [];
					
					for (let i=0; i<es.variables.length; i++) {
						const vars = es.variables[i];
						const vID = vars[0];

						const d = domains.get(vID);
						let valueID;

						if (d.length > 1) {
							// value is a domain,
							const dData = zvs.getData(branchId, vID);
							const dID = zvs.getData(branchId, dData.id);
							const domain = {
								type: "domain",
								data: d.map(v => zvs.getObject(branchId, v)),
								id: dID
								// TODO: this should have foward change field ?? 
							};

							valueID = zvs.data.add(domain);

							// add new domain to branch.
							branchDomains.push(domain);
						}
						else {
							// valueID = zvs.data.add(zvs.getObject(branchId, d[0]));
							valueID = d[0];
						}

						for (let i=0; i<vars.length; i++) {
							// make equal variables,
							const v = vars[i];
							zvs.branches.transform(newBranchId, v, valueID);
						}

					}

					zvs.branches.transform(newBranchId, DOMAINS_ID, 
						zvs.data.add({
							type: "domains",
							data: branchDomains,
							// TODO: check change field name.
							change: newBranchId
						})
					);
				}

				return flopBranches;
			}
		}

		return [branchId];
	}
	catch (e) {
		// at least one negation fails, all branch must fail.
		// console.log(e);
	}
}

/**
 * TODO:
	 * [^!(equal (number 0) (number @id$18=[0, 1, 2, 3]))
	 * This is wrong, it should be: [^!(equal (number 0) (number @id$18=[1, 2, 3]))
		 * since constant is cartesian product.
		 1. if (number 0) was a domain: (number [0, 1, 2, 3])
		 	1a. 
 */

async function checkNegations (action, data, destination, session) {
	let { branches, branchId } = data;
	const zvs = session.zvs;

	branches = branches || [
		[branchId]
	];

	const queryId = zvs.data.global("query");

	const results = [];

	for (let i = 0; i < branches.length; i++) {
		const bs = branches[i];
		const rBranches = [];
		results.push(rBranches);

		for (let j = 0; j < bs.length; j++) {
			const branchId = bs[j];

			// utils.printQuery(zvs, branchId, "CHECK NEGATIONS (1)");

			let nots = zvs.getData(
				branchId,
				zvs.getData(branchId, queryId).negation
			);

			if (nots) {
				nots = nots.filter(filterExistsUndef(zvs, branchId));
			}

			if (nots && nots.length) {
				// eval negations,

				const eBranches = await evalNegations(session, branchId, nots);

				if (eBranches && eBranches.length) {
					rBranches.push(...eBranches);
				}				
            }
            else {
                // Branch branchId, don't have any negations to eval.
				rBranches.push(branchId);
            }
		}

		if (!rBranches.length) {
			// fail,
			session.postOffice.subActives(destination, 1);
			return;
		}
	}

	if (branchId) {
		/**
		 * TODO: this is a weird case, we should only handle branches array ... 
		 */
		session.postOffice.addActives(destination, 1);
		session.queue.put({
			action: "success",
			data: { branchId },
			destination
		});
	}
	else if (results.length > 1) {
		session.postOffice.addActives(destination, 1);
		session.queue.put({
			action: "merge",
			data: { branches: results },
			destination
		});
	}
	else {
		const bs = results[0];
		session.postOffice.addActives(destination, bs.length);
		
		for (let i=0; i<bs.length; i++) {
			const b = bs[i];

			session.queue.put({
				action: "filterUncheckedTuples",
				data: b,
				destination
			});
		}
	}

	session.postOffice.subActives(destination, 1);

}

module.exports = checkNegations;
