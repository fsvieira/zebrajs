"use strict";

const utils = require("../../../utils");
const {multiplyFlop, getFlop} = require("../../../flop");

const Domains = require("../../../variables/domains");

const {
	prepare
} = require("../definitions");

/**
 * TODO:
 * 
 * ** Domains and Negations:
 * 
 * 1. (branchId, negations):
 * 	- we need to group negations with their branchId,
 *  - if all or some negations succed with flop:
 * 		- we need to multiply flop domain with all other negations flop domains,
 * 		- ex. ^(equal [0, 1] [0, 1]) ^(equal [0, 1] 0)
 * 			- domain A: [{x: 0, y:1}, {x: 1, y:0}]
 * 			- domain B: [{x: 1, y:0}]
 *			--> to all negations succed the result domain is A ** B => [{x: 1, y:0}]
 *			- if result is empty [], then negations fail.
 *	- we can only flop variables/domains that are in the original branch:
 *		a. original variables and domain remains the same but there is a flop ?
 *        -- this should not be possible but negation should fail in that case.
 *      b. original variables change, but domain contains other variables:
 * 		  -- discard all other variables, the state is given by original variables/domains.
 *
 *	2. Create domain branches, we need to insert this branches where branchId is inserted
	   (in the branch group where branchId is in)
	   - and we need to remove branchId in case of flops ?
			   - yes because flop will intersect with all negations, in case of one negation 
			   doenst have a flop and still fails we need to consider that negation as the acept all flop.
	
	3. send 
 */


/*
    if none of negations variables are on the query than we
    can eval negation.
*/
function canEval (zvs, branchId, tupleId, queryVariables) {
	const negationVariables = getVariables(zvs, branchId, tupleId, true);

	for (let i = 0; i < negationVariables.length; i++) {
		const v = negationVariables[i];

		if (queryVariables.indexOf(v) !== -1) {
			return false;
		}
	}

	return true;
}

/*
    TODO: we can use this process to (and move it somewhere else):
        - get unchecked tuples,
        - get variables,
        - check for cyclic tuples.
*/
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

function failedNegation (branches, branchId) {
	return () => {
		// at least one of negations has failed,
		// we need to remove branch,
		const index = branches.indexOf(branchId);
		branches.splice(index, 1);

		if (branches.length === 0) {
			return Promise.reject();
		}

		// TODO: what should be returned here ? self = true ? 
		return Promise.resolve({parentBranchId: branchId});
	};
}

/**
 * Exists stuff,
 */
/*
function getDomains (zvs, branchId, tupleId) {
	const tuples = [tupleId];
	const done = [tupleId];
	const domains = [];

	while(tuples.length) {
		const tupleId = tuples.pop(); 
		const tuple = zvs.getData(branchId, tupleId);
		const data = zvs.getData(branchId, tuple.data);

		for (let i=0; i<data.length; i++) {
			const id = zvs.branches.getDataId(branchId, data[i]);
			const v = zvs.getData(branchId, id);
			const type = zvs.getData(branchId, v.type);

			if (type === "tuple") {
				if (!done.includes(id)) {
					tuples.push(id);
					done.push(id);
				}
			}
			else if (type === 'domain') {
				if (!domains.includes(id)) {
					domains.push(id);
				}
			}
		}
	}

	return domains;
}*/

async function exists (session, branchId, tupleId) {
	const neg = session.zvs.getObject(branchId, tupleId);
	const DOMAINS = session.zvs.data.global("domains");
	const jsonDomain = session.zvs.getObject(branchId, DOMAINS);
	const domains = Domains.fromJSON(session.zvs, jsonDomain);

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

	const { branchId: queryBranchId } = session.zvs.branches.getId({
		parent: definitionsBranchId,
		args: [nQueryId],
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
	 * 		- Tuple domain should only contain tuple variables. 
	 * 		- Currently it contains the full original query.
	 */
	session.zvs.branches.transform(
		queryBranchId,
		DOMAINS,
		session.zvs.branches.getDataId(branchId, DOMAINS)
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
		for (let i=0; i<data.length; i++) {
			const b = data[i];

			flop = getFlop(flop, session.zvs, b, domains);

			if (!flop) {
				session.zvs.update(branchId, tupleId, { exists: true });
				// console.log("Query exists!!");
				throw "Query exists";
			}
		}
	}
	
	session.zvs.update(
		branchId,
		tupleId,
		{ exists: false }
	);

	//	"Query does not exist!!";
	return {flop};
}

function negations (action, data, destination, session) {
	// const { zvs, exists } = req.context;
	const zvs = session.zvs;
	const { branches, negations: negs, branchId } = data;

	if (negs.length === 0) {
		if (branchId) {
			session.postOffice.addActives(destination, 1);
			session.queue.put({
				action: "success",
				data: { branchId },
				destination
			});
		}
		else if (branches.length > 1) {
			session.postOffice.addActives(destination, 1);
			session.queue.put({
				action: "merge",
				data: { branches },
				destination 
			});
		}
		else {
			const bs = branches[0];

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
		return;
	}

	const execute = branchId !== undefined;
	const evalAllNegations = [];

	for (let i = 0; i < negs.length; i++) {
		const { branchId, negations: nots, branches } = negs[i];
		const evalBranchNegations = [];

		const queryVariables = getVariables(zvs, branchId);

		for (let j = nots.length - 1; j >= 0; j--) {
			const tupleId = nots[j];

			if (execute || canEval(zvs, branchId, tupleId, queryVariables)) {
				nots.splice(j, 1);

				evalBranchNegations.push(exists(session, branchId, tupleId));
			}
		}

		evalAllNegations.push(
			Promise.all(evalBranchNegations).then(solutions => {
				let flop;

				for (let i=0; i<solutions.length; i++) {
					const {flop: flops} = solutions[i];

					if (flops) {
						flop = flop?flop.intersect(flops):flops;

						if (flop.isEmpty()) {
							return Promise.reject();
						}
						/*
						flop = multiplyFlop(flop, flops);
						// console.log("\n\nFLOP => " + JSON.stringify(flop));

						if (flop && flop.length === 0) {
							return Promise.reject();
						}*/
					}
				}

				return {parentBranchId: branchId, flop}
			}, failedNegation(branches, branchId))
		);
	}

	Promise.all(evalAllNegations).then(domains => {
		// const branches = [];

		for (let i=0; i<domains.length; i++) {
			// TODO: transform branch => branchId,
			const {parentBranchId, flop, self} = domains[i];

			const flopBranches = [];

			if (flop) {
				// TODO: replace domain with flop.
				console.log("FLOP => " + flop.toDot());

				for (let j=0; j<flop.length; j++) {
					const domains = flop[j];

					// TODO: args should not be an domain object, but id array.
					const newBranchId = zvs.branches.getId({
						parent: parentBranchId,
						args: domains,
						action: "flop"
					}).branchId;

					if (!flopBranches.includes(newBranchId)) {
						flopBranches.push(newBranchId);

						for (let v in domains) {
							const d = domains[v];
							zvs.branches.transform(
								newBranchId,
								+v,
								zvs.data.add(d.data.length===1?d.data[0]:d)
							);
						}

						// utils.printQuery(zvs, newBranchId, "FLOP");
					}
				}

				if (self) {
					flopBranches.push(parentBranchId);
				}
			}
			else {
				flopBranches.push(parentBranchId);
			}

			for (let i=0; i<branches.length; i++) {
				const bs = branches[i];
				const index = bs.indexOf(parentBranchId);

				if (index !== -1) {
					bs.splice(index, 1, ...flopBranches);
				} 
			}
		}

		if (branchId) {
			// res.send({ value: { branchId } });
			session.postOffice.addActives(destination, 1);
			session.queue.put({
				action: "success",
				data: { branchId },
				destination
			});
		}
		else if (branches.length > 1) {
			// res.send({ value: { branches } });
			session.postOffice.addActives(destination, 1);
			session.queue.put({
				action: "merge",
				data: { branches },
				destination
			});
		}
		else {
			const bs = branches[0];
			session.postOffice.addActives(destination, bs.length);
			
			for (let i=0; i<bs.length; i++) {
				const b = bs[i];
				session.queue.put({
					action: "filterUncheckedTuples",
					data: b,
					destination
				});
			}

			// res.send({ values: branches[0] });
		}

		session.postOffice.subActives(destination, 1);
	}, () => {
		session.postOffice.subActives(destination, 1);
	});
}

module.exports = negations;
