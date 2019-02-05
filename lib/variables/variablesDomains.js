const IdenticObjects = require("identicobjects");
const utils = require("../utils");
const {
    combinations,
    combinationsGenerator
} = require("./combinations");

function getBranchesAllValues(zvs, branches, variables, io) {
    let results = new Set();

    for (let i=0; i<branches.length; i++) {
        const branchId = branches[i];

        const r = [];
        for (let i=0; i<variables.length; i++) {
            const vID = variables[i];
            const v = zvs.getData(branchId, vID);
            const type = zvs.getData(branchId, v.type);

            if (type === 'constant') {
                const c = zvs.branches.getDataId(branchId, vID);
                r.push({variables: [vID], domain: [c]});
            }
            else {
                const data = zvs.getData(branchId, v.data);

                r.push({variables: [vID], domain: data.slice()});
            }
        }

        const s = getCombValues(r, variables, io);

        results = new Set([...results, ...s]);

    }

    return results;
}


/**
 * DIFF COMBO
 * =============================
 */

function diffCombinations (domains) {
    const results = [];
    const d = domains.pop();

    for (let k=0; k<d.domain.length; k++) {
        const value = d.domain[k];
        const r = [{variables: d.variables, domain: [value]}];

		if (domains.length) {
            const ds = [];
            for (let l=0; l<domains.length; l++) {
                const d = domains[l];
                const values = d.domain.filter(v => v !== value);

                if (values.length) {
                    ds.push({
                        variables: d.variables,
                        domain: values
                    });
                }
                else {
                    return;
                }
            }

            const dr = diffCombinations(ds);

            if (dr) {
                for (j=0; j<dr.length; j++) {
                    results.push(r.concat(dr[j]));
                }
            }
            else {
                return;
            }
        }
        else {
            results.push(r);
        }
    }

    return results;
}

function explode (r, domains) {
	if (domains && domains.length) {
		const comb = diffCombinations(domains);
        
        if (comb) {
            return comb.map(c => c.concat(r));
        }
	}
	else {
		return [r];
	}
}

/*
 * ======================
*/
function getCombValues(comb, variables, io) {
    const domains = comb.filter(v => v.domain.length > 1);
    const constants = comb.filter(v => v.domain.length === 1);
    let results = new Set();

    const r = explode(constants, domains);

    if (r) {
        // separet variables,
        for (let i=0; i<r.length; i++) {
            const cs = r[i];
            const rs = [];

            for (let i=0; i<cs.length; i++) {
                const c = cs[i];

                for (let i=0; i<c.variables.length; i++) {
                    const vID = c.variables[i];

                    rs.push({
                        variables: [vID],
                        domain: c.domain
                    });
                }
            }

            results = new Set([
                ...results,
                io.get(
                    rs.sort(({variables: [a]}, {variables: [b]}) => variables.indexOf(a) - variables.indexOf(b))
                    .map(v => v.domain[0])
                )
            ]);
        }
        
        return results;
    }
}

function getCombAllValues(comb, variables, io) {
    let r = new Set();

    
    for (let i=0; i<comb.length; i++) {
        const c = comb[i];
        const combValues = getCombValues(c, variables, io);

        if (combValues) {
            r = new Set([
                ...r, 
                ...combValues
            ]);
        }
        else {
            return;
        }
    }


    return r;
}

function checkCombinationsValues (zvs, variables, branches, comb) {
    // Get all values,

    const io = new IdenticObjects();
    const bracnhesValues = getBranchesAllValues(zvs, branches, variables, io);
    const combAllValues = getCombAllValues(comb, variables, io);

    if (combAllValues && bracnhesValues.size === combAllValues.size) {
        for (const v of bracnhesValues) {
            if (!combAllValues.has(v)) {
                return {fail: true};
            }
        }

        return {fail: false};
    }

    return {fail: true};

}

function compute (zvs, branches, tupleId, variables, queryBranchId) {

    // 1. get all domains ids from query branch,
    const DOMAINS_ID = zvs.data.global("domains");
    const queryDomains = zvs.getData(queryBranchId, DOMAINS_ID);
    const queryDomainsData = zvs.getData(queryBranchId, queryDomains.data) || [];
    const variablesDomains = variables.concat(queryDomainsData).sort();
    variables.sort();

    const io = new IdenticObjects();
    // 2. Get all values from domains and variables,
    const values = new Map();
    for (let i=0; i<variablesDomains.length; i++) {
        const vID = variablesDomains[i];
        let s = new Set();

        for (let i=0; i<branches.length; i++) {
            const branchId = branches[i];
            const d = zvs.getData(branchId, vID);
            const type = zvs.getData(branchId, d.type);
            
            if (type === 'constant') {
                s.add(zvs.branches.getDataId(branchId, vID));
            }
            else {
                const data = zvs.getData(branchId, d.data);
                s = new Set([...s, ...data]);
            }
        }

        values.set(vID, s);
    }

    // 3. Generate variable equal combinations,
    const variableCombinations = new Set();
    for (let vs of combinationsGenerator(variables)) {
        let domain = values.get(vs[0]);
            
        for (let i=1; i<vs.length; i++) {
            domain = new Set([...domain].filter(v => domain.has(v)));

            // if variables don't intersect then we can't make them equal.
            if (domain.size === 0) {
                break;
            }
        }

        if (domain.size > 0) {
            // 3a. make combinations of domain values,
            for (let ds of combinationsGenerator([...domain])) {
                // don't add constants
                // if (ds.length > 1) {
                    variableCombinations.add({
                        variables: vs,
                        domain: ds.sort()
                    });
                // }
            }
        }
    }

    // 4. Add more combinations, equal variables + one domain.
    // 4a. Since all domains are different we cant group two domains toggether.
    for (let vs of new Set(variableCombinations)) {
        for (let i=0; i<queryDomainsData.length; i++) {
            const vID = queryDomainsData[i];
            const vd = values.get(vID);

            const domain = vs.domain.filter(v => vd.has(v));

            if (domain.length) {
                const variables = vs.variables.slice();
                variables.push(vID);

                variables.sort();
                domain.sort();

                for (let ds of combinationsGenerator(domain)) {
                    // don't add constants,
                    // if (ds.length > 1) {
                        variableCombinations.add({
                            variables,
                            domain: ds
                        });
                    // }
                }
            }

            // and add individual domain,
            for (let ds of combinationsGenerator([...vd])) {
                // don't add constants,
                // if (ds.length > 1) {
                    variableCombinations.add({
                        variables: [vID],
                        domain: ds
                    });
                // }
            }
        }
    }

    // 5. We now need to combine all equal combinations, variables can't intersect.
    const equalCombinations = new Set();
    for (let vs of combinationsGenerator([...variableCombinations], 1, variablesDomains.length)) {
        // 5a. check that variables don't intersect,        
        const variables = new Set();
        const constants = new Set();
        let vCount = 0;
        let fail = false;

        for (let i=0; i<vs.length; i++) {
            const v = vs[i];

            for (let i=0; i<v.variables.length; i++) {
                let count = variables.size;
                const a = v.variables[i];

                variables.add(a);

                if (count === variables.size) {
                    fail = true;
                    break;
                }
            }

            if (v.domain.length > 1) {
                vCount++;
                for (let i=0; i<v.domain.length; i++) {
                    const c = v.domain[i];
                    constants.add(c);
                }
            }
        }

        // check that all values fit on variables:
        // Simple test, does not filter all "bad" results.
        if ((constants.size / vCount) < 1) {
            continue;
        }

        if (!fail && variables.size === variablesDomains.length) {
            // order vs before add,
            vs.sort((a, b) => a.variables[0] - b.variables[0]);
            const es = equalCombinations.size;

            const vID = io.get(vs);

            equalCombinations.add(vID);
        }
    }

    // 7. Group combinations, they can't excced number of branches,
    const max = branches.length * 1;

    let results;
    let countDomains = 0;
    const fails = new Set();
    const ec = [...equalCombinations];

    for (let comb of combinationsGenerator(ec, 1, max)) {

        if (results && results.length < comb.length) {
            break;
        }

        const countCombDomains = comb.map(v => v.map(v => v.domain).filter(v => v.length > 1)).filter(v => v.length > 0).length;
        
        if (countDomains >= countCombDomains) {
            // if found solution has more domains than this comb, then keep current solution.
            continue;
        }

        let fail = false;
        for (let i=0; i<comb.length; i++) {
            if (fails.has(comb[i])) {
                fail = true;
                break;
            }
        }

        if (fail) {
            continue;
        }
    
        // 7b. check that at least union domain of variable covers all values,
        const variableValues = new Map();

        for (let i=0; i<comb.length; i++) {
            const vs = comb[i];

            for (let i=0; i<vs.length; i++) {
                const v = vs[i];

                for (let i=0; i<v.variables.length; i++) {
                    const id = v.variables[i];
                    const s = variableValues.get(id) || new Set();

                    variableValues.set(id, new Set([...s, ...v.domain]));
                }
            }
        }
            
        for (let [v, domain] of variableValues) {
            const domainValues = values.get(v);

            if (domainValues.size !== domain.size) {
                fail = true;
                break;
            }
        }

        if (fail) {
            continue;
        }

        // 7b. check that combinations cover all branches values,
        // TODO:
        //  * check should return the fail combo, so that we can remove all groups containing the fail combo.

        // * TODO:
        //  - check that combinations results don't intersect.

        const r = checkCombinationsValues(
            zvs,
            variablesDomains,
            branches,
            comb
        );

        if (r.nomatch) {
            r.nomatch.forEach(v => fails.add(v));
        }

        if (!r.fail) {
            countDomains = countCombDomains;
            results = comb;
        }
    }

    return composeBranches(zvs, queryBranchId, tupleId, results, branches);
}


function composeBranches (zvs, queryBranchId, tupleId, branchesCombinations, branches) {
    if (branchesCombinations) {
        const results = [];

        const DOMAINS_ID = zvs.data.global("domains");

        for (let i=0; i<branchesCombinations.length; i++) {
            const values = branchesCombinations[i];

            // Create new branch from query branch, and set values.
            const newBranch = zvs.branches.getId({
                parent: queryBranchId,
                args: {branches, i},
                action: "domains"
            }).branchId;

            const domains = {
                type: "domains",
                data: (zvs.getData(newBranch, zvs.getData(newBranch, DOMAINS_ID).data) || []).map(
                    v => zvs.getObject(newBranch, v)
                ),
                id: newBranch
            };

            for (let j=0; j<values.length; j++) {
                const v = values[j];

                if (v.domain.length === 1) {
                    // make all variables constants,
                    const value = v.domain[0];
                    for (let i=0; i<v.variables.length; i++) {
                        zvs.branches.transform(newBranch, v.variables[i], value);
                    }
                }
                else {
                    const variable = v.variables[0];
                    const domain = {
                        type: 'domain',
                        data: v.domain.map(v => zvs.getObject(newBranch, v)),
                        id: variable,
                        change: newBranch
                    };
                        
                    const domainID = zvs.data.add(domain);

                    domains.data.push(domain);

                    for (let i=0; i<v.variables.length; i++) {
                        const variable = v.variables[i];
                        zvs.branches.transform(newBranch, variable, domainID);
                    }
                }
            }

            zvs.branches.transform(newBranch, DOMAINS_ID, zvs.data.add(domains));
            zvs.update(newBranch, tupleId, {check: true});

            results.push(newBranch);
        }

        return results;
    }

    return branches;
}

module.exports = {compute};
