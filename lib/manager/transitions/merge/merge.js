"use strict";

const actionUnify = require("../tuples/actionUnify");
const utils = require("../../../utils");

function intersections (zvs, aBranches, bBranches) {
	const ids = {};
	let hits = 0;

	for (let i = 0; i < aBranches.length; i++) {
		const branch = zvs.branches.getRawBranch(aBranches[i]);
		const changes = branch.metadata.changes;

		for (let id in changes) {
			if (changes.hasOwnProperty(id)) {
				ids[id] = true;
				ids[branch.metadata.changes[id]] = true;
			}
		}
	}

	for (let i = 0; i < bBranches.length; i++) {
		const branch = zvs.branches.getRawBranch(bBranches[i]);

		for (let id in branch.metadata.changes) {
			if (ids[id] || ids[branch.metadata.changes[id]]) {
				hits++;
			}
		}
	}

	return hits / bBranches.length;
}

function select (zvs, value) {
	// get all branches intersect,
	// choose 2 that have higth intersect number.

	let results = [];

	for (let i = 0; i < value.length; i++) {
		const aBranches = value[i];

		for (let j = i + 1; j < value.length; j++) {
			const bBranches = value[j];
			const rs = aBranches.length * bBranches.length;

			const hits = intersections(zvs, aBranches, bBranches);

			if (hits > 0) {
				results.push({
					branches: {
						a: aBranches,
						b: bBranches
					},
					index: { i, j },
					rs,
					hits
				});
			}
		}
	}

	if (results.length > 0) {
		results.sort((a, b) => b.hits - a.hits || a.rs - b.rs);

		const r = results[0];

		value.splice(r.index.j, 1);
		value.splice(r.index.i, 1);

		return r.branches;
	}

	value.sort((a, b) => a.length - b.length);

	return {
		a: value.shift(),
		b: value.shift()
	};

}

function merge (action, data, destination, session) {
	const zvs = session.zvs;
	const { branches } = data;

	/**
	 * order branches groups by size,
	 */

	console.log("MERGE => " + branches.length);

	while (branches.length > 1) {
		branches.sort((a, b) => b.length - a.length);

		const a = branches.pop();
		const b = branches.pop();

		let nr = [];

		for (let i = 0; i < a.length; i++) {
			const bA = a[i];

			for (let j = 0; j < b.length; j++) {
				let bB = b[j];

				// bA * bB				
				let bs = zvs.merge(
					[bA, bB],
					actionUnify,
					"unify&merge"
				);

				if (bs && bs.length) {
					nr = nr.concat(bs);
				}
				/*
				else {
					console.log(
						"=== FAIL MERGE ===\n" + 
						utils.toStringDomain(
							zvs.getObject(bA, zvs.data.global("domains")),
							zvs.getObject(bA, zvs.data.global("query")),
							true
						) + "\n ** \n" + 
						utils.toStringDomain(
							zvs.getObject(bB, zvs.data.global("domains")),
							zvs.getObject(bB, zvs.data.global("query")),
							true
						) +
						"\n=== MERGE END ===\n" 
					);
				}*/
			}
		}

		if (nr.length === 0) {
			// everything fails,
			//  fail,
			//  TODO: we need to fail father branch,
			//  zvs.branches.notes(
			//	branchId,
			//	{status: {fail: true, reason: "merge fail!"}});

			// console.log("FAIL TO MERGE!!");
			session.postOffice.subActives(destination, 1);
			console.log("---  Merge FAIL ---");

			return;
		}

		branches.push(nr);
	}

	console.log("---  Merge End ---");
	/*
	    we need to make sure that single branches
	    pass the merge phase.
	*/
	/*
	const singles = [];

	for (let i = branches.length - 1; i >= 0; i--) {
		const bs = branches[i];

		if (bs.length === 1) {
			singles.push(bs[0]);
			branches.splice(i, 1);
		}
	}

	if (singles.length) {
		while (singles.length > 1) {
			const bA = singles.pop();
			const bB = singles.pop();

			const s = zvs.merge(
				[bA, bB],
				actionUnify,
				"unify&merge"
			);

			if (s) {
				singles.push(s[0]);
			}
			else {
				session.postOffice.subActives(destination, 1);
				return;
			}
		}

		if (branches.length === 1) {
			branches.push(singles);
		}
		else {
			results.push(singles);
		}
	}

	// Select negation branches
	while (branches.length > 1) {
		const { a, b } = select(zvs, branches);

		if (a.length * b.length < 100) {

			let nr = [];

			for (let i = 0; i < a.length; i++) {
				const bA = a[i];

				for (let j = 0; j < b.length; j++) {
					let bB = b[j];

					// bA * bB
					let bs = zvs.merge(
						[bA, bB],
						actionUnify,
						"unify&merge"
					);

					if (bs && bs.length) {
						nr = nr.concat(bs);
					}
				}
			}

			if (nr.length === 0) {
				// everything fails,
				//  fail,
				//  TODO: we need to fail father branch,
				//  zvs.branches.notes(
				//	branchId,
				//	{status: {fail: true, reason: "merge fail!"}});

				session.postOffice.subActives(destination, 1);
				return;
			}

			results.push(nr);
		}
		else {
			branches.push(a.length < b.length ? a : b);
		}
	}

	if (branches.length > 0) {
		results.push(branches[0]);
	}*/

	session.postOffice.addActives(destination, 1);
	session.queue.put({
		action: "filterUncheckedNegations",
		data: {
			branches
		},
		destination
	});

	session.postOffice.subActives(destination, 1);
}

module.exports = merge;
