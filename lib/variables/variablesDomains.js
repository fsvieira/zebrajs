const IdenticObjects = require("identicobjects");
const utils = require("../utils");
const combinations = require("./combinations");

/**
 * TODO:
 *  1. Make combinator as generator or iterator,
 *  2. Order combinations from more values to less values,
 *  3. Stop when reaches best solution (with less "branhces").
 */

function diffCombinations (domains) {
    const results = [];
    const d = domains.pop();

    for (let k=0; k<d.values.length; k++) {
        const value = d.values[k];
        const r = [];
            
        for (j=0; j<d.variables.length; j++) {
            const variable = d.variables[j];

            r.push({variables: [variable], values: [value]});
        }

        if (domains.length) {
            const ds = [];
            for (let l=0; l<domains.length; l++) {
                const d = domains[l];
                const values = d.values.filter(v => v !== value);

                if (values.length) {
                    ds.push({
                        variables: d.variables,
                        values: values
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

function getValueBranch (zvs, bs, vs) {
    for (let i=0; i<vs.length; i++) {
        if (bs.length) {
            const {variables: [variable], values: [value]} = vs[i];

            for (let j=bs.length-1; j>=0; j--) {
                const branchId = bs[j];

                const v = zvs.branches.getDataId(branchId, variable);

                if (v !== value) {
                    bs.splice(j, 1);
                }
            }
        }
        else {
            return;
        }
    }

    return bs[0];
}

function checkCombinations (zvs, b, variables, c) {

    // get combinator constants
    const constants = c.filter(v => v.values.length === 1);
    const domains = c.filter(v => !constants.includes(v));

    const values = diffCombinations(domains.slice());

    if (values) {

        if (constants.length) {
            for (let i=0; i<values.length; i++) {
                values[i] = values[i].concat(constants);
            }
        }

        if (values.length === b.length) {
            const bs = new Set(b);

            for (let i=0; i<values.length; i++) {
                const vs = values[i];

                const branch = getValueBranch(zvs, [...bs], vs);
                
                if (branch) {
                    bs.delete(branch);
                }
                else {
                    return false;
                }
            }

            return bs.size === 0;
        }
    }

    return false;
}

function merge (io, zvs, b, variables) {
    if (b.length > 1) {
        // 1. extract all variables domains,
        const domains = new Map();

        // 1a. group all equals domains,
        const valuesVariables = new Map();

        for (let i=0; i<variables.length; i++) {
            const v = variables[i];
            const values = new Set();
        
            for (let j=0; j<b.length; j++) {
                const branchId = b[j];
        
                const value = zvs.branches.getDataId(branchId, v);
                values.add(value);
            }
        
            const vs = io.get([...values].sort());
            domains.set(v, vs);

            if (values.size > 1) {
                const vSet = valuesVariables.get(vs);

                if (vSet) {
                    vSet.add(v);
                }
                else {
                    valuesVariables.set(vs, new Set([v]));
                }
            }
        }

        // 2. make all equal domains combinations,
        let vv = new Set();
        let all = [];

        for (let [values, variables] of valuesVariables) {
            if (variables.size > 1) {
                const vs = [...variables];
                const comb = combinations(vs).map(variables => io.get({
                    variables,
                    values
                }));

                vv = new Set([...vv, ...comb]);
            }

            all.push({
                variables: [...variables],
                values
            });
        }

        const comb = combinations([...vv]).concat([all]).map(vs => {
            const vars = variables.filter(v => {
                for (let i=0; i<vs.length; i++) {
                    if (vs[i].variables.includes(v)) {
                        return false;
                    }
                }

                return true;
            });

            // inject variables,
            for (let i=0; i<vars.length; i++) {
                const v = vars[i];

                vs.push({
                    variables: [v],
                    values: [...domains.get(v)]
                });
            }

            return vs;
        });

        // 3. test all combinations values.
        const c = comb.filter(c => checkCombinations(zvs, b, variables, c));

        if (c.length) {
            // we only need one.
            return c[0];
        }
    }
}

function compute (zvs, branches, tupleId, variables, queryBranchId) {

    // (A x B) x C = A x (B x C)
    const io = new IdenticObjects();

    // 1. make all brances combinations,
    const bs = combinations(branches);

    // 2. merge all branches combinations,
    const m = new Map();
    for (let i=0; i<bs.length; i++) {
        const b = io.get(bs[i]);

        const values = merge(io, zvs, b, variables);

        if (values) {
            m.set(b, values);
        }
    }

    const comb = combinations([...m.keys()]).filter(c => {
        // Filter combinations with no intersections,
        let eq = new Set();

        for (let i=0; i<c.length; i++) {
            const s = c[i];

            const test = eq.size + s.length;
            eq = new Set([...eq, ...s]);

            if (eq.size !== test) {
                return false;
            }
        }

        return true;
    })
    .map(c => {
        // Fill missing branches,
        const bs = branches.filter(b => {
            for (let i=0; i<c.length; i++) {
                if (c[i].includes(b)) {
                    return false;
                }
            }

            return true;
        });
        
        for (let i=0; i<bs.length; i++) {
            c.push(io.get([bs[i]]));
        }

        return c;
    })
    .sort((a, b) => a.length - b.length);
    
    const branchesCombinations = comb[0];

    if (branchesCombinations) {
        const results = [];

        const DOMAINS_ID = zvs.data.global("domains");

        for (let i=0; i<branchesCombinations.length; i++) {
            const b = branchesCombinations[i];

            if (b.length > 1) {
                const values = m.get(b);

                // Create new branch from query branch, and set values.
                const newBranch = zvs.branches.getId({
                    parent: queryBranchId,
                    args: b,
                    action: "domains"
                }).branchId;

                const domains = {
                    type: "domains",
                    data: zvs.getObject(newBranch, DOMAINS_ID).data || []
                };

                for (let j=0; j<values.length; j++) {
                    const v = values[j];

                    if (v.values.length === 1) {
                        // make all variables constants,
                        const value = v.values[0];
                        for (let i=0; i<v.variables.length; i++) {
                            zvs.branches.transform(newBranch, v.variables[i], value);
                        }
                    }
                    else {
                        const domain = {
                            type: 'domain',
                            data: v.values.map(v => zvs.getObject(zvs.branches.root, v)),
                            id: v.variables[0]
                        };
                        
                        const domainID = zvs.data.add(domain);

                        domains.data.push(domain);

                        for (let i= 0; i<v.variables.length; i++) {
                            zvs.branches.transform(newBranch, v.variables[i], domainID);
                        }
                    }
                }

                zvs.branches.transform(newBranch, DOMAINS_ID, zvs.data.add(domains));
                zvs.update(newBranch, tupleId, {check: true});

                results.push(newBranch);
            }
            else {
                results.push(b[0]);
            }
        }

        return results;
    }

    return branches;
}

module.exports = {compute};
