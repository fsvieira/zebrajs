// const Domains = require("../../../variables/domains");
// const FSA = require("fsalib");
const utils = require("../../../utils");
const IdenticObjects = require("identicobjects");

const VariablesDomains = require("../../../variables/variablesDomains");

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

function createDomains (zvs, bm, variables, queryBranchId) {

    // 1. extract all different variable domains:
    const diff = variables.filter(v => !bm.equals.includes(v));

    // 2. extract values of equals variables:
    let eqBranchId = queryBranchId;
    if (bm.equals.length) {
        // extract equal values domains,

        const eq = {};

        for (let i=0; i<bm.equals.length; i++) {
            const v = bm.equals[i];
            const d = eq[v] = [];
            for (let j=0; j<bm.branches.length; j++) {
                const branchId = bm.branches[j];
                d.push(zvs.branches.getDataId(branchId, v));
            }
        }

        eqBranchId = zvs.branches.getId({
            parent: eqBranchId,
            // TODO: 
            //   * the branch id should be get from the used branches on domains not all branches,
            args: bm.branches.slice(),
            action: "="
        }).branchId;

        const v = bm.equals[0];
        const domainId = zvs.data.add({type: "domain", data: eq[v].map(v => zvs.getObject(zvs.branches.root, v)), id: v});

        const vars = Object.keys(eq);
        for (let i=0; i<vars.length; i++) {
            const v = +vars[i];
            zvs.branches.transform(eqBranchId, v, domainId);
        }

        // TODO: remove equal variables from variables branch, we only need one.
    }

    // 3. extract values of distinct variables:
    const df = {};
    for (let i=0; i<diff.length; i++) {
        const v = diff[i];
        const d = df[v] = [];
        for (let j=0; j<bm.branches.length; j++) {
            const branchId = bm.branches[j];
            d.push(zvs.branches.getDataId(branchId, v));
        }
    }

    // 4. TODO: we need to check cominatorial of domains, 

    // 5. create branches and unify values:
    // - 
    // just for now lets create a new branch for new diff domain :D

    
    const newBranchId = zvs.branches.getId({
        parent: eqBranchId,
        // TODO: 
        //   * the branch id should be get from the used branches on domains not all branches,
        args: bm.branches.slice(),
        action: "<>"
    }).branchId;

    for (let v in df) {
        const domain = {type: 'domain', data: df[v].map(v => zvs.getObject(zvs.branches.root, v)), id: v};
        const domainId = zvs.data.add(domain);

        zvs.branches.transform(newBranchId, +v, domainId);
    }

    return [newBranchId];
}

function computeBranches (branches, branchesMerge) {
    const bm = [];

    for (let b of branchesMerge.values()) {
        const domains = {};
        for (let [v, values] of b.domains) {
            domains[v] = [...values];
        }

        bm.push({
            branches: [...b.branches],
            equals: [...b.equals],
            different: [...b.different],
            constants: [],
            domains
        });
    }

    return branches;
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
                    }
                }

                const negations = zvs.getObject(branchId, QUERY_ID).negation;
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
                for (let branchId of VariablesDomains.compute(zvs, [...branches], tupleId, vs, queryBranchId)) {
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

function _3_domains (action, data, destination, session) {
    const {zvs} = session;
    const { branches, branchId : queryBranchId } = data;

    const results = [];

    const QUERY_VARIABLES = zvs.data.global("variables");
    const queryVariables = zvs.getData(queryBranchId, QUERY_VARIABLES);
    const queryVariablesData = zvs.getData(queryBranchId, queryVariables.data);

    const io = new IdenticObjects();

    for (let i=0; i<branches.length; i++) {
        let {branches: bs, variables, tupleId} = branches[i];

        // if query has no variables there is nothing to do.
        if (queryVariablesData.length === 0 || bs.length === 1) {
            // there is no need to extract domains if there is only one branch,
            results.push(bs);
        }
        else {
            // Construct domains,
            // 1. find equals
            const branchesMerge = new Map();

            for (let i=0; i<bs.length; i++) {
                const branchId = bs[i];
                const values = new Map();

                for (let j=0; j<variables.length; j++) {
                    const v = variables[j];
                    const value = zvs.branches.getDataId(branchId, v);

                    const e = values.get(value);
                    if (!e) {
                        values.set(value, [v]);
                    }
                    else {
                        e.push(v);
                    }
                }

                const equals = new Set();
                const different = new Set();
                const domains = new Map();
                for (let [value, vs] of values) {
                    if (vs.length > 1) {
                        equals.add(io.get(vs));
                    }
                    else {
                        different.add(vs[0]);
                    }

                    for (let i=0; i<vs.length; i++) {
                        const v = vs[i];
                        domains.set(v, new Set([value]));
                    }
                }

                const id = io.get([...equals]);
                let bm = branchesMerge.get(id);

                if (!bm) {
                    bm = {
                        branches: new Set([branchId]),
                        equals,
                        different,
                        constants: new Set(),
                        domains
                    }

                    branchesMerge.set(id, bm);
                }
                else {
                    bm.branches.add(branchId);
                    bm.equals = new Set([...equals, ...bm.equals]);
                    bm.different = new Set([...different, ...bm.different]);

                    for (let [key, values] of domains) {
                        const dv = bm.domains.get(key);

                        if (dv) {
                            bm.domains.set(key, new Set([...values, ...dv]));
                        }
                        else {
                            bm.domains.set(key, values);
                        }
                    }
                }
            }            

            results.push(computeBranches(bs, branchesMerge));

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

// TODO : we are not handling negations.
function __domains (action, data, destination, session) {
    const zvs = session.zvs;
    const { branches, branchId : queryBranchId } = data;
    const results = [];

    const QUERY_VARIABLES = zvs.data.global("variables");
    const queryVariables = zvs.getData(queryBranchId, QUERY_VARIABLES);
    const queryVariablesData = zvs.getData(queryBranchId, queryVariables.data);

    for (let i=0; i<branches.length; i++) {
        let {branches: bs, variables, tupleId} = branches[i];

        // if query has no variables there is nothing to do.
        if (queryVariablesData.length === 0 || bs.length === 1) {
            // there is no need to extract domains if there is only one branch,
            results.push(bs);
        }
        else {
            // create states for each variable.
            const branchesMerge = {};

            for (let i=0; i<bs.length; i++) {
                const branchId = bs[i];
                const equals = {};

                for (let j=0; j<variables.length; j++) {
                    const v = variables[j];
                    const value = zvs.branches.getDataId(branchId, v);

                    const e = equals[value] = equals[value] || []; 
                    e.push(v);
                }

                const id = [];
                for (let value in equals) {
                    id.push(equals[value]);
                }

                const idStr = JSON.stringify(id);
                const eb = branchesMerge[idStr] = branchesMerge[idStr] || {branches: [], equals: []};

                for (let value in equals) {
                    const vs = equals[value];
                    if (vs.length > 1) {
                        for (let i=0; i<vs.length; i++) {
                            const v = vs[i];
                            if (!eb.equals.includes(v)) {
                                eb.equals.push(v);
                                eb.equals.sort();
                            }
                        }
                    }
                }

                eb.branches.push(branchId);
            }

            const r = [];
            for (let id in branchesMerge) {
                const bm = branchesMerge[id];

                if (bm.branches.length === 1) {
                    r.push(bm.branches[0]);
                }
                else {
                    r.push(...createDomains(zvs, bm, variables, queryBranchId));
                }
            }

            for (let i=0; i<r.length; i++) {
                const b = r[i];
                // zvs.update(b, tupleId, {check: true});
                utils.printQuery(zvs, b, "Test");
            }

            results.push(r);
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


function _domains (action, data, destination, session) {

	const zvs = session.zvs;
	const { branches, branchId : queryBranchId } = data;
    const results = [];

    // original nots
    const queryId = zvs.data.global("query");
    const queryNegationID = zvs.getData(queryBranchId, queryId).negation;
    const queryNegation = zvs.getData(queryBranchId, queryNegationID);

    const parentDomainJSON = zvs.getObject(queryBranchId, zvs.data.global("domains")); 

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

            // Merge with parent domain:
            //  1. check if parent has a domain,
            if (parentDomainJSON.type === 'domains' && !parentDomainJSON.branchId) {
                const parentDomain = Domains.fromJSON(zvs, parentDomainJSON);

                s.merge(parentDomain);
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
