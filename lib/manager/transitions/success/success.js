"use strict";

const utils = require("../../../utils");

function success (action, data, destination, session) {
	const {branchId} = data;
	const zvs = session.zvs;

	const queryBranchId = zvs.getObject(
		branchId,
		zvs.data.global("queryBranchId")
	).data;

	zvs.branches.end({
		rootBranchId: queryBranchId,
		branchId,
		success: true
	});

	// session.postOffice.
	session.postOffice.push(destination, branchId);
	session.postOffice.subActives(destination, 1);
}

module.exports = success;
