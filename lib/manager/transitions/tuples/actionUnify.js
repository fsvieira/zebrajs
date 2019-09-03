"use strict";

const unify = require("./unify");
const utils = require("../../../utils");

function actionUnify (zvs, { branchId: parentBranchId, args: [p, q] }) {
	const parent = zvs.branches.getRawBranch(parentBranchId);

	if (parent.metadata) {
		Object.freeze(parent.metadata.changes);
	}

	const branchId = zvs.branches.getId({
		parent: parentBranchId,
		args: [p, q],
		action: "unify",
		level: parent.data.level + 1
	}).branchId;

	const r = unify(zvs, branchId, p, q);

	if (!r) {
		zvs.branches.end({ branchId, fail: true, reason: "unify fail!" });
	}

	return r;
}

module.exports = actionUnify;
