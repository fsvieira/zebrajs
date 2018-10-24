const Ids = require("../../../zvs/ids");
const utils = require("../../../utils");
const Domains = require("../../../variables/domains");

/**
 * Compares two sorted arrays to check if they 
 * are equal.
 */
/*
function isEqual (a, b) {
    if (a.length === b.length) {
        for (let i=0; i<a.length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }

        return true;
    }

    return false;
}
*/

/*

class Domains {
    constructor (zvs) {
        // only used on toDot, only for debug.
        this.zvs = zvs;
        this.states = {};
        this.transitions = {};
        this.stateIDs = new Ids();
        this.statesCounter = 0;
        const startData = [this.statesCounter++];
        this.start = this.stateIDs.id(startData);
        this.states[this.start] = startData;
        this.symbols = new Ids();
        this.symbolsTable = {};
        this.finals = [];
    }

    transition (from, symbol, to) {
		const t = this.transitions[from] = this.transitions[from] || {};
		const s = t[symbol] = t[symbol] || [];
		if (!s.includes(to)) {
			s.push(to);
		}
	}

    add (values) {
        values.sort((a, b) => a.variable - b.variable);

        let state = this.start;
        for (let i=0; i<values.length; i++) {
            const value = values[i];
            const symbol = this.symbols.id(value);
            this.symbolsTable[symbol] = values[i];

            const toData = [this.statesCounter++];
            const to = this.stateIDs.id(toData);
            this.states[to] = toData;

            this.transition(state, symbol, to);
            state = to;
        }
        
        this.finals.push(state);
    }

    deterministic (stateID) {
		stateID = stateID || this.start;

		const symbols = this.transitions[stateID];

		if (!symbols) {
			return;
		}

		for (let symbol in symbols) {
			if (symbols.hasOwnProperty(symbol)) {
				const states = symbols[symbol];

                if (states.length > 1) {
                    const joinID = this.getStateJoinID(states);

					if (!this.transitions[joinID]) {
						for (let i = 0; i < states.length; i++) {
                            const n = states[i];
							const symbols = this.transitions[n];
							this.copySymbolsToState(joinID, symbols);
						}
					}

					symbols[symbol] = [joinID];
					this.deterministic(joinID);
                }
                else {
                    this.deterministic(states[0])
                }
			}
		}
    }

    getStateJoinID (states) {
		if (states.length > 1) {
			const joinStates = [];

			for (let i = 0; i < states.length; i++) {
				const s = states[i];
				const state = this.states[s];

				for (let j = 0; j < state.length; j++) {
					const t = state[j];

					if (!joinStates.includes(t)) {
						joinStates.push(t);
					}
				}

				joinStates.sort();
			}

			const stateID = this.stateIDs.id(joinStates);

            if (!this.finals.includes(stateID)) {
                const r = states.filter(s => this.finals.includes(s));

                if (r.length > 0) {
                    this.finals.push(stateID);
                }
            }

            this.states[stateID] = joinStates;
			return stateID;
		}
		else {
			return states[0];
		}
	}

    copySymbolsToState (joinID, symbols) {
		if (symbols) {
			for (let symbol in symbols) {
				if (symbols.hasOwnProperty(symbol)) {
					const tos = symbols[symbol];

					for (let j = 0; j < tos.length; j++) {
						const t = tos[j];
						this.transition(joinID, symbol, t);
					}
				}
			}
		}
	}

    clean () {
        const tos = [this.start];
        const states = [this.start];

        while (tos.length) {
            const state = tos.pop();
            const symbols = this.transitions[state];

            const domains = {};
            let v;
    
            for (let symbol in symbols) {
                if (symbols.hasOwnProperty(symbol)) {
                   const stos = symbols[symbol];

                    for (let i=0; i<stos.length; i++) {
                        const to = stos[i];
                        if (!states.includes(to)) {
                            tos.push(to);
                            states.push(to);
                        }
                    }
                }
            }
        }

        // delete all states that are not on states,
        for (let s in this.transitions) {
            if (!states.includes(+s)) {
                delete this.transitions[s];
                delete this.states[s];

                const i = this.finals.indexOf(+s);
                if (i >= 0) {
                    this.finals.splice(i, 1);
                }
            }
        }
    }

    minimizeDFA () {
        // https://en.wikipedia.org/wiki/DFA_minimization
        
        // init,
        const states = Object.keys(this.states).map(v => +v).sort(); 
        const p = [states.filter(s => !this.finals.includes(s)).sort(), this.finals.slice()];
        const w = [p[1]];
        const symbols = Object.keys(this.symbolsTable);

        while (w.length) {
            const a = w.pop();

            for (let s=0; s<symbols.length; s++) {
                const c = symbols[s];

                // let X be the set of states for which a transition on c leads to a state in A
                const x = states.filter(s => {
                    const symbols = this.transitions[s];
                    if (symbols) {
                        const tos = symbols[c];
                        if (tos) {
                            return a.includes(tos[0]);
                        }
                    }

                    return false;
                });

                // for each set Y in P for which X ∩ Y is nonempty and Y \ X is nonempty do
                for (let pi=0; pi<p.length; pi++) {
                    // replace Y in P by the two sets X ∩ Y and Y \ X
                    const y = p[pi];
                    const xny = y.filter(s => x.includes(s));
                    const yex = y.filter(s => !x.includes(s));
                
                    if (xny.length > 0 && yex.length > 0) {
                        p.splice(pi, 1, xny, yex);

                        // if Y is in W
                        const index = w.findIndex(x => isEqual(x, y));
                        if (index !== -1) {
                            // replace Y in W by the same two sets
                            w.splice(index, 1, xny, yex);
                        }
                        else {
                            // if |X ∩ Y| <= |Y \ X|
                            if (xny.length <= yex.length) {
                                // add X ∩ Y to W
                                w.push(xny);
                            }
                            else {
                                // add Y \ X to W 
                                w.push(yex);
                            }
                        }
                    }
                }
            }
        }


        const statesTable = {};
        const transitions = {};
        const f = [];

        for (let i=0; i<p.length; i++) {
            const states = p[i];
            const newState = this.getStateJoinID(states);
            f.push(newState);

            for (let j=0; j<states.length; j++) {
                const s = states[j];
                statesTable[s] = newState;
            }
        }

        for (let i=0; i<states.length; i++) {
            const state = states[i];
            const ts = this.transitions[state];
            const from = statesTable[state];

            if (ts) {
                for (let c in ts) {
                    const tos = ts[c];
                    if (tos) {
                        const to = statesTable[tos[0]];
                        const fs = transitions[from] = transitions[from] || {};

                        fs[c] = [to];
                    }
                }
            }
        }

        this.transitions = transitions;
        this.finals = this.finals.filter(s => f.includes(s));
    }

    minimize () {
        // this.toDot();

        this.deterministic();
        this.clean();

        this.minimizeDFA();
        // console.log(this.toDot());
    }

    // Split domains on unify types: tuples and variables
    split (ds) {
        const r = [];

        while (ds.length) {
            const domain = ds.pop();
            let ins = true;

            for (let v in domain) {
                const values = domain[v];

                if (values.length > 1) {
                    const vars = values.filter(v => v.type === "unify");

                    if (vars.length > 0) {
                        ins = false;

                        for (let j=0; j<vars.length; j++) {
                            const n = Object.assign({}, domain);
                            n[v] = [vars[j]];
                            
                            ds.push(n);
                        }

                        if (vars.length < values.length) {
                            const n = Object.assign({}, domain);
                            n[v] = values.filter(v => v.type === "value");

                            ds.push(n);
                        }
                    }
                }
            }

            if (ins) {
                r.push(domain);
            }
        }

        return r;
    }

    domain () {
        this.minimize();
        const ds = this._domain();

        return this.split(ds);
    }

    _domain (state) {
        state = state || this.start;

        const symbols = this.transitions[state];

        const domains = {};
        let v;

        for (let symbol in symbols) {
            if (symbols.hasOwnProperty(symbol)) {
                const {variable, value} = this.symbolsTable[symbol];

                const to = symbols[symbol][0];
                const values = domains[to] = domains[to] || [];

                values.push(value);
                v = variable;
            }
        }

        const results = [];

        for (let to in domains) {
            const vs = this._domain(to);

            if (vs.length > 0) {
                for (let i=0; i<vs.length; i++) {
                    const d = {...vs[i]};

                    d[v] = domains[to];
                    results.push(d);
                }
            }
            else {
                const d = {};
                d[v] = domains[to];
                results.push(d);
            }
        }

        return results;
    }

    toDot() {
        let table = "";

        for (let from in this.transitions) {
            const symbols = this.transitions[from];
            for (let symbolID in symbols) {
                const tos = symbols[symbolID];
                const symbol = this.symbolsTable[symbolID];
                const symbolStr = utils.toString(this.zvs.getObject(this.zvs.branches.root, symbol.value.data), true) + "::" + symbol.value.type +  "::" + symbolID;
                for (let t=0; t<tos.length; t++) {
                    const to = tos[t];
                    table += "\t" + from + " -> " + to + ' [label = "' + symbolStr + '"]\n';
                }
            }
        }

        const g = 'digraph Domain {\n' +
            '\trankdir=LR;\n' +
            '\tsize="8,5"\n' +
            '\tnode [shape = doublecircle]; '+ this.finals.join(" ") +';\n' +
            '\tnode [shape = circle];\n' +
            table +
        "}";

        return g;
    }
}*/

/*
    TODO:
        * branches = 1, don't calculate domain, keep branch,
        * domains = 0, keep branches, (no variables)
        * domains === branches, keep branches.
        * domains < branches, generate branches from domains.

        -- Negations:
            * handle negations as a normal variable, except that its not atached to any tuple.
        
        -- Variables:
            1) if a variable contains new variables:
                - convert all new variables to existing variables, if not possible:
                    - convert new varible to min id variable mark it as new.

            2) if a variable is equal to other variables:
                - ex. e=(equal a b) then we need to create a branch where a=b.

        -- Tuples:
            - Using variables step we can consider tuples as simple values.
*/

/*
function toString (domain, zvs, branchId) {
    const ds = [];
    for (let j=0; j<domain.length; j++) {
        const d = domain[j];
        const dvars = {};

        for (let v in d) {
            const dv = d[v].map(value => zvs.getObject(branchId, value));
            vs = utils.toString(zvs.getObject(branchId, +v));

            // we need to save variable id, so that a variable gets only one value.
            dvars[vs] = utils.toString({type: "domain", data: dv, variable: +v});
        }

        ds.push(dvars);
    }
}*/

/**
 * TODO: normalize variables that are not on query:
 * 1) tuples are the same with diferente variables names,
 * 2) we need to take into account that variables need to appear in the same positions. 
 */

/*
function normalize (zvs, queryBranchId, branchId, id, defer) {
    const d = defer[id];

    if (d) {
        console.log(JSON.stringify(zvs.getObject(branchId, id)) + " => " + JSON.stringify(zvs.getObject(branchId, d)));

        return d;
    }

    const v = zvs.getData(branchId, id);
    const type = zvs.getData(branchId, v.type);

    if (type === 'tuple') {
        const tupleData = zvs.getData(branchId, v.data);
        const tuple = {type: 'tuple', data: []};
        for (let i=0; i<tupleData.length; i++) {
            const id = tupleData[i];
            const d = defer[id];

            if (d) {
                tuple.data[i] = zvs.getObject(queryBranchId, d);
            }
            else {
                const nID = normalize(zvs, queryBranchId, branchId, id, defer);
                tuple.data[i] = zvs.getObject(branchId, nID);
            }
        }

        // add data,
        return zvs.data.add(tuple);
    }
    else {
        return id;
    }
}

function isTupleEqual (zvs, a, b, variables, vtable) {
    if (a === b) {
        // ids are equal.
        return true;
    }

    if (variables.includes(a) || variables.includes(b)) {
        // ids are diferent,
        // at least on of variables is query original variable.
        // So at this stage it can't unify with any other variable. 
        return false;
    }

    const aData = zvs.getData(zvs.branches.root, a);
    const aType = zvs.getData(zvs.branches.root, aData.type);

    const bData = zvs.getData(zvs.branches.root, b);
    const bType = zvs.getData(zvs.branches.root, bData.type);

    if (aType===bType) {
        if (bType === 'tuple') {
            const aValues = zvs.getData(zvs.branches.root, aData.data);
            const bValues = zvs.getData(zvs.branches.root, bData.data);
    
            if (aValues.length === bValues.length) {
                // compare tuples,
                for (let i=0; i<aValues.length; i++) {
                    const aID = aValues[i];
                    const bID = bValues[i];

                    if (!isTupleEqual(zvs, aID, bID, variables, vtable)) {
                        return false;
                    }
                }

                // all values are equal,
                return true;
            }
        }
        else if (bType === 'variable') {
            const va = vtable[a] = vtable[a] || b;
            const vb = vtable[b] = vtable[b] || a;

            
            // both a and b variables are not original variables,
            // if variables can be bind to only one variable then 
            // variables are equal, else they are not.

            return va === b && vb === a;
        }

        // values have same types, but no unifiable data.
    }

    // values have diferent types
    // and if ids are not equal then they have diferent data.
    return false;
}

function isValueEqual (zvs, a, b, variables) {
    if (a === b) {
        return true;
    }

    const aData = zvs.getData(zvs.branches.root, a);
    const aType = zvs.getData(zvs.branches.root, aData.type);

    const bData = zvs.getData(zvs.branches.root, b);
    const bType = zvs.getData(zvs.branches.root, bData.type);

    if (aType === 'tuple' && bType === 'tuple' && aData.length === bData.length) {
        return isTupleEqual(zvs, a, b, variables, {});
    }

    return false;
}*/

function domains (action, data, destination, session) {
	const zvs = session.zvs;
	const { branches, branchId : queryBranchId } = data;
    const results = [];

    // original nots
    const queryId = zvs.data.global("query");
    const queryNegationID = zvs.getData(queryBranchId, queryId).negation;
    const queryNegation = zvs.getData(queryBranchId, queryNegationID);

    for (let i=0; i<branches.length; i++) {
        // TODO: we can get varibles when constructing domain and avoid unecessary computations.
        let {branches: bs, variables, domains, tupleId} = branches[i];
        // console.log(JSON.stringify(variables.map(v => zvs.getObject(queryBranchId, v))));

        /*
        if (domains && domains.length) {
            console.log("Domains => " + JSON.stringify(domains));
        }*/
        variables = variables.concat(domains).sort();

        if (bs.length === 1 || variables.length === 0) {
            // there is no need to extract domains if there is only one branch,
            results.push(bs);
        }
        else {
            // TODO: if we calc variables here we will need to test if there is any variables to compute domain. 
            // const s = new Domains(zvs);
            const s = new Domains(zvs, [...variables]); //, "n"]);
            // const values = [];

            // (tuple) * [definitions] = bs, where bs is array of generated branches,
            for (let b=0; b<bs.length; b++) {
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

                // all extracted variables are for unifications, has they have been extracted from original
                // variables.
                for (let v in defer) {
                    defer[v] = +defer[v].filter(vf => variables.includes(vf)).sort()[0];
                    if (defer[v] === +v) {
                        delete defer[v];
                    }
                }

                /*
                for (let v=0; v<variables.length; v++) {
                    const id = variables[v];
                    const dataId = zvs.branches.getDataId(branchId, id);

                    const data = zvs.getData(branchId, dataId);
                    const type = zvs.getData(branchId, data.type);

                    if (defer[dataId]) {
                        values.push({group: b, variable: id, value: {type: 'unify', data: defer[dataId]}});
                    }
                    else if (type === 'tuple') {
                        values.push({group: b, variable: id, value: {type: 'unify', data: normalize(zvs, queryBranchId, branchId, dataId, defer)}});
                    }
                    else {
                        values.push({group: b, variable: id, value: {type: 'value', data: dataId}});
                    }
                }

                const negationID = zvs.getData(branchId, queryId).negation;

                if (queryNegationID !== negationID) {
                    const nots = zvs.getData(
                        branchId,
                        negationID
                    );

                    if (queryNegation.length !== nots.length) {
                        const normalizeNots = nots.map(tupleId => normalize(zvs, queryBranchId, branchId, tupleId, defer));
                        normalizeNots.sort();

                        values.push({group: b, variable: 'n', value: {type: 'negation', data: normalizeNots}});
                    }
                    else {
                        values.push({group: b, variable: 'n', value: {type: 'negation'}});
                    }
                }
                else {
                    values.push({group: b, variable: 'n', value: {type: 'negation'}});
                }*/

                const word = [];
                for (let v=0; v<variables.length; v++) {
                    const id = variables[v];
                    const s = zvs.branches.getDataId(branchId, id);
                    const symbol = defer[s] || s;

                    word.push(symbol);
                }

                s.add(word);
            }

            /*
            for (let i=0; i<values.length-1; i++) {
                const a = values[i];
                if (a.value.type === 'value') {
                    for (let j=i+1; j<values.length; j++) {
                        const b = values[j];

                        if (b.value.type === 'value' && b.value.data !== a.value.data) {
                            if (isValueEqual(zvs, a.value.data, b.value.data, variables)) {
                                b.value.data = a.value.data;
                            }
                        }
                    }
                }
            }

            let groups = {};
            for (let i=0; i<values.length; i++) {
                const v = values[i];
                const g = groups[v.group] = groups[v.group] || [];
                delete v.group;
                g.push(v);
            }

            for (let g in groups) {
                s.add(groups[g]);
            }*/

            // const domain = s.domain();
            // console.log(s.toDot());
            // console.log(JSON.stringify(domain, null, " "));

            const dv = s.splitFilter();
            const group = [];

            for (let i=0; i<dv.length; i++) {
                const {domain, variables} = dv[i];

                // 1. create branch,
                const b = zvs.branches.getId({
                    parent: queryBranchId,
                    args: bs,
                    action: "domains"
                }).branchId;
    
                // 2. update or set domains on new branch, 
                zvs.branches.transform(b, zvs.data.global("domains"), zvs.data.add(domain.toJSON()));
                zvs.update(b, tupleId, {check: true});

                // 3. change domain variables to type domain,
                for (let vID of domain.variables) {
                    zvs.update(b, vID, {type: "domain"});
                }
    
                // 4. unify variables,
                for (let j=0; j<variables.length; j++) {
                    const {variable, value} = variables[j];
                    zvs.branches.transform(b, variable, value);
                }

                group.push(b);
            }

            results.push(group);

            /*
            console.log("------");
            
            const domain = s.toJSON();
            const b = zvs.branches.getId({
                parent: queryBranchId,
                args: bs,
                action: "domains"
            }).branchId;

            zvs.branches.transform(b, zvs.data.global("domains"), zvs.data.add(domain));
            zvs.update(b, tupleId, {check: true});

            for (let vID of s.variables) {
                zvs.update(b, vID, {type: "domain"});
            }

            // TODO: remove variables and tuples.

            results.push([b]);
            */

            /*
            if (domain.length < bs.length) {
                // convert domains to branches,
                const group = [];

                for (let j=0; j<domain.length; j++) {
                    const d = domain[j];

                    // TODO: bs is the same for all domains, if possible we could only set args for the branches that 
                    // contribute for domain.
                    const b = zvs.branches.getId({
                        parent: queryBranchId,
                        args: bs,
                        action: "domains",
                        domain: j
                    }).branchId;
    
                    zvs.update(b, tupleId, {check: true});

                    for (let v in d) {
                        const dv = [];

                        if (d[v].length === 1) {
                            const {type, data} = d[v][0];

                            if (type === 'unify') {
                                if (data !== +v) {
                                    zvs.branches.transform(
                                        b, +v,
                                        data
                                    );
                                }
                            }
                            else if (type === 'negation') {
                                if (data) {
                                    const negation = data.map(tupleId => zvs.getObject(queryBranchId, tupleId));

                                    zvs.update(
                                        b,
                                        queryId,
                                        {
                                            negation
                                        }
                                    );
                                }
                            }
                            else {
                                zvs.branches.transform(
                                    b, +v,
                                    data
                                );
                            }
                        }
                        else {
                            for (let k=0; k<d[v].length; k++) {
                                const {type, data} = d[v][k];

                                if (type === 'value') {
                                    dv.push(zvs.getObject(queryBranchId, data));
                                }
                                else if (type === 'unify') {
                                    if (data !== +v) {
                                        zvs.branches.transform(
                                            b, +v,
                                            data
                                        );
                                    }
                                }
                                else if (type === 'negation') {
                                    if (data) {
                                        const negation = data.map(tupleId => zvs.getObject(queryBranchId, tupleId));

                                        zvs.update(
                                            b,
                                            queryId,
                                            {
                                                negation
                                            }
                                        );
                                    }
                                }
                            }
                        }

                        if (dv.length > 0) {
                            zvs.branches.transform(
                                b, +v,
                                zvs.data.add({type: "domain", data: dv, variable: +v})
                            );
                        }
                    }

                    group.push(b);
                }

                results.push(group);
            }
            else {
                results.push(bs);
            }*/
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
