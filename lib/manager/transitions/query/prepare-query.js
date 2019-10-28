"use strict";

const prepare = require("../definitions/prepare");
const Match = require("../../../match/match");
// const {getVariables} = require("../../utils");
const utils = require("../../../utils");


function prepareQuery (action, data, destination, session) {

	function genId () {
		return "id$" + session.store.id++;
	}

	const { query, definitions } = data;
	const zvs = session.zvs;

	const definitionsId = zvs.data.add(definitions);

	const definitionsBranchId = zvs.branches.getId({
		parent: zvs.branches.root,
		args: [definitionsId],
		action: "definitions"
	}).branchId;

	zvs.branches.transform(
		definitionsBranchId,
		zvs.data.global("definitions"),
		zvs.data.add({
			type: "definitions",
			data: {
				definitions,
				branchId: definitionsBranchId
			}
		})
	);

	const match = new Match(zvs);

	const definitionsIds = zvs.getData(definitionsBranchId, definitionsId);

	match.addTuples(definitionsIds);
	zvs.addDefinitionsMatch(definitionsBranchId, match);

	const preparedQuery = prepare.copyWithVars(query.data, genId);
	const queryId = zvs.data.add(preparedQuery);

	const { branchId: queryBranchId } = zvs.branches.getId({
		parent: definitionsBranchId,
		args: [queryId],
		action: "query",
		func: query.func
	});

	zvs.branches.transform(
		queryBranchId,
		zvs.data.global("queryBranchId"),
		zvs.data.add({
			type: "query",
			data: queryBranchId
		})
	);

	zvs.branches.transform(queryBranchId, zvs.data.global("query"), queryId);

	session.postOffice.addActives(destination, 1);
	session.queue.put({
		action: "filterUncheckedTuples", 
		data: queryBranchId,
		destination
	});

	session.postOffice.subActives(destination, 1);
}

module.exports = prepareQuery;
