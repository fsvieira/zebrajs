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

	const domains = session.zvs.branches.getDomains(branchId);

	session.zvs.branches.setDomains(queryBranchId, domains);

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
		let s;
		for (let i=0; i<data.length; i++) {
			const branchId = data[i];
			const negDomains = zvs.branches.getDomains(branchId);
			s = s?s.union(negDomains):negDomains;
		}

		flop = domains.symmetricDifference(s);

		if (flop.isEmpty()) {
			session.zvs.update(branchId, tupleId, { exists: true });
			throw "Query exists";
		}
	}
	// If query doesn't exists, then negation holds.
	/*
	else {
		// we are unable to fail all branches,
		session.zvs.update(branchId, tupleId, { exists: true });
		throw "Query exists";
	}*/

	session.zvs.update(
		branchId,
		tupleId,
		{ exists: false }
	);

	// "Query does not exist!!";
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
			const { branchId: newBranchId} = session.zvs.branches.getId({
				parent: branchId,
				action: "flop"
			});

			session.zvs.branches.setDomains(newBranchId, flop);

			return [newBranchId];
		}

		return [branchId];
	}
	catch (e) {
		// at least one negation fails, all branch must fail.
		// console.log(e);
	}
}

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
