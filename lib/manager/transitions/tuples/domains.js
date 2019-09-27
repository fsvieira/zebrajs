const utils = require("../../../utils");
const IdenticObjects = require("identicobjects");
const Table = require("../../domains/table");

function normalize (zvs, tuple, defer) {
    const tuples = [tuple];

    while (tuples.length) {
        t = tuples.pop();

        for (let i=0; i<t.data.length; i++) {
            const v = t.data[i];
            if (v.type === 'variable') {
                // check if is defer variable,
                t.data[i] = defer[v.id] || v;
            }
            else if (v.type === 'tuple') {
                tuples.push(v);
            }
        }
    }

    return zvs.data.add(tuple);
}

function *computeBranches (zvs, branches, tupleId, vs, queryBranchId) {

    // TODO: 
    // 1. get variables and domains, from original query branch.
    const DOMAINS_ID = zvs.data.global("domains");
    const queryDomains = zvs.getData(queryBranchId, DOMAINS_ID);
    const queryDomainsData = zvs.getData(queryBranchId, queryDomains.data) || [];
    const header = vs.concat(queryDomainsData).sort();

    if (header.length === 0) {
        for (let branchId of branches) {
            yield branchId;
        }

        return;
    }

    // 2. Create new value table,
    const vt = new Table(header);

    for (let branchId of branches) {
        // 3. extract values from branches, (ENE coding)
        const domains = header.map(id => {
            const vID = zvs.branches.getDataId(branchId, id);
            const data = zvs.getData(branchId, vID);
            const type = zvs.getData(branchId, data.type);

            if (type === 'constant') {
                return [id, vID]
            }
            else {
                return [id, zvs.getData(branchId, data.data)]
            }
        });

        // 4. add values to table.
        vt.addENERow(domains);
    }

    // 5. Get ENE coding from table,
    const ene = vt.toENE();

    for (let newBranchId of vt.eneBranches(zvs, ene, queryBranchId, branches, "domain", tupleId)) {
        yield newBranchId;
    }
}

function domains (action, data, destination, session) {
    const {zvs} = session;
    const { branches, branchId : queryBranchId } = data;
    const results = [];

    for (let i=0; i<branches.length; i++) {
        let {branches: bs, variables, tupleId} = branches[i];
        
        const rs = [];
        // if query has no variables there is nothing to do.
        if (variables.length === 0 || bs.length === 1) {
            // there is no need to extract domains if there is only one branch,
            rs.push(...bs);
        }
        else {
            const branchSplit = new Map();
            const QUERY_ID = zvs.data.global("query");
            const io = new IdenticObjects();

            for (let i=0; i<bs.length; i++) {
                // 1. collect all variables,
                const branchId = bs[i];

                zvs.debugCheckTree(branchId);

                const defer = {};

                for (let v=0; v<variables.length; v++) {
                    const id = variables[v];
                    const valueID = zvs.branches.getDataId(branchId, id);

                    const value = zvs.getData(branchId, id);
                    const valueType = zvs.getData(branchId, value.type);

                    if (valueType === 'variable') {
                        const ds = (defer[id] || [id]).concat(defer[valueID] || [valueID]);
                        const s = [];
                        
                        for (let i=0; i<ds.length; i++) {
                            const di = ds[i];
                            defer[di] = s;

                            if (!s.includes(di)) {
                                s.push(di)
                            }
                        }
                    }
                }

                for (let v in defer) {
                    defer[v] = +defer[v].filter(vf => variables.includes(vf)).sort()[0];
                    if (defer[v] === +v) {
                        delete defer[v];
                    }
                }
    
                const deferVars = {};
                for (let v in defer) {
                    const vID = zvs.getObject(branchId, +v).id;
                    deferVars[vID] = zvs.getObject(queryBranchId, defer[v]);
                }

                const word = [];
                for (let v=0; v<variables.length; v++) {
                    const id = variables[v];
                    const s = zvs.branches.getDataId(branchId, id);
                    
                    if (defer[s]) {
                        word.push({
                            variable: id,
                            value: defer[s]
                        });
                    }
                    else {
                        const value = zvs.getData(branchId, s);
                        const valueType = zvs.getData(branchId, value.type);
    
                        if (valueType === 'tuple') {
                            word.push({
                                variable: id,
                                value: normalize(
                                    zvs,
                                    zvs.getObject(branchId, s),
                                    deferVars
                                )
                            });
                        }
                        else if (valueType === 'variable') {
                            word.push({
                                variable: id
                            });
                        }
                    }
                }

                const queryNegations = zvs.getObject(queryBranchId, QUERY_ID).negation;
                const tupleNegations = zvs.getObject(branchId, QUERY_ID).negation;

                /**
                 * If negations did not change use original negations for spliting.
                 */
                const negations = queryNegations.length === tupleNegations.length?queryNegations:tupleNegations;

                if (negations.length) {
                    for (let i=0; i<negations.length; i++) {
                        const n = negations[i];
                        negations[i] = normalize(zvs, n, deferVars);
                    }

                    const negationsID = zvs.data.add(negations.map(n => zvs.getObject(queryBranchId, n)));
                    word.push({
                        variable: "n",
                        value: negationsID
                    });
                }

                const w = io.get(word);

                const branches = branchSplit.get(w);

                if (branches) {
                    branches.add(branchId);
                }
                else {
                    branchSplit.set(w, new Set([branchId]));
                }
            }

            for (let [values, branches] of branchSplit) {
                // 1. remove variables that are on values, so we can trie to find best branch fit. 
                const vv = values.map(v => v.variable).filter(v => v !== "n");
                const vs = variables.filter(v => !vv.includes(v));
                const vl = values.filter(v => v.variable !== v.value);

                const r = [];
                for (let branchId of computeBranches(zvs, branches, tupleId, vs, queryBranchId)) {

                    for (let i=0; i<vl.length; i++) {
                        const v = vl[i];
                        if (v.variable === 'n') {
                            zvs.update(branchId, QUERY_ID, {
                                negation: zvs.getObject(branchId, v.value)
                            });
                        }
                        else {
                            zvs.branches.transform(branchId, v.variable, v.value);
                        }
                    }

                    r.push(branchId);
                }

                rs.push(...r);
            }
        }

        results.push(rs);
    }

    results.forEach(bs => bs.forEach(b => zvs.debugCheckTree(b)));


    session.postOffice.addActives(destination, 1);
    session.queue.put({
		action: "checkNegations",
        data: {
            branches: results
        },
        destination
    });

    session.postOffice.subActives(destination, 1);
}

module.exports = domains;
