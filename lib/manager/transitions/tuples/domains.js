const Domains = require("../../../variables/domains");
const utils = require("../../../utils");

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

function domains (action, data, destination, session) {

	const zvs = session.zvs;
	const { branches, branchId : queryBranchId } = data;
    const results = [];

    // original nots
    const queryId = zvs.data.global("query");
    const queryNegationID = zvs.getData(queryBranchId, queryId).negation;
    const queryNegation = zvs.getData(queryBranchId, queryNegationID);

    const parentDomain = zvs.getObject(queryBranchId, zvs.data.global("domains")); 

    if (parentDomain.type === 'domains' && !parentDomain.branchId) {
        console.log("TODO: MERGE PARENT DOMAINS!!");
    }

    for (let i=0; i<branches.length; i++) {
        // TODO: we can get varibles when constructing domain and avoid unecessary computations.
        let {branches: bs, variables /*, domains*/, tupleId} = branches[i];

        if (bs.length === 1 || variables.length === 0) {
            // there is no need to extract domains if there is only one branch,
            results.push(bs);
        }
        else {
            // TODO: if we calc variables here we will need to test if there is any variables to compute domain. 
            const s = new Domains(zvs, [...variables, "n"]); //, "n"]);

            // (tuple) * [definitions] = bs, where bs is array of generated branches,
            for (let b=0; b<bs.length; b++) {
                // TODO: handle negations,
                const branchId = bs[b];

                // 1. collect all variables,
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

                    let symbol = s;
                    if (defer[s]) {
                        symbol = defer[s];
                    }
                    else {
                        const value = zvs.getData(branchId, s);
                        const valueType = zvs.getData(branchId, value.type);
    
                        if (valueType === 'tuple') {
                            symbol = normalize(
                                zvs,
                                zvs.getObject(branchId, s),
                                deferVars
                            );
                        }
                    }

                    word.push(symbol);
                }

                const negations = zvs.getObject(branchId, queryId).negation;
                for (let i=0; i<negations.length; i++) {
                    const n = negations[i];
                    negations[i] = normalize(zvs, n, deferVars);
                }

                const negationsID = zvs.data.add(negations.map(n => zvs.getObject(queryBranchId, n)));
                word.push(negationsID);

                s.add(word);
            }

            const dv = s.splitFilter();

            if (dv.length >= bs.length) {
                results.push(bs);
            }
            else {
                const group = [];

                for (let di=0; di<dv.length; di++) {
                    const {domain, variables} = dv[di];

                    // 1. create branch,
                    const b = zvs.branches.getId({
                        parent: queryBranchId,
                        // TODO: 
                        //   * the branch id should be get from the used branches on domains not all branches,
                        args: {domain: di, bs},
                        action: "domains"
                    }).branchId;

                    const d = domain.toJSON();

                    if (domain.isEmpty()) {
                        // since domain is empty, we need to make sure is empty unique to forwared changing of domain.
                        d.branchId = b;
                    }

                    // 2. update or set domains on new branch, 
                    zvs.branches.transform(b, zvs.data.global("domains"), zvs.data.add(d));
                    zvs.update(b, tupleId, {check: true});

                    // 3. change domain variables to type domain,
                    for (let vID of domain.variables) {
                        zvs.update(b, vID, {type: "domain"});
                    }
        
                    // 4. unify variables,
                    // Last variable is negation.
                    for (let j=0; j<variables.length-1; j++) {
                        const {variable, value} = variables[j];
                        zvs.branches.transform(b, variable, value);
                    }

                    // 5. update negations,
                    const {value} = variables[variables.length-1];
                    zvs.update(
                        b,
                        queryId,
                        {
                            negation: zvs.getObject(b, value)
                        }
                    );

                    group.push(b);
                }

                results.push(group);
            }
        }
    }

    session.postOffice.addActives(destination, 1);
    session.queue.put({
        action: "filterUncheckedNegations",
        data: {
            branches: results
        },
        destination
    });

    session.postOffice.subActives(destination, 1);
}

module.exports = domains;
