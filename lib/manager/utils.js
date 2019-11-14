function getVariables (zvs, branchId, tupleId) {
	const tuples = [tupleId];
	const done = [tupleId];
	const variables = [];

	while (tuples.length) {
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
			else if (type === 'variable') {
				if (!variables.includes(id)) {
					variables.push(id);
				}
			}
			/*
			else if (type === 'domain') {
				if (!domains.includes(id)) {
					domains.push(id);
				}
			}*/
		}
	}

	// return {variables, domains};
	return variables;
}

module.exports = {getVariables};
