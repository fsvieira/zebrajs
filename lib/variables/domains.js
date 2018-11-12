const FSA = require("fsalib");
const utils = require("../utils");


class Domains {

    constructor (zvs, variables, fa) {
        this.zvs = zvs;
        this.fa = fa || new FSA();
        this.variables = variables;
    }

    add (values) {
        if (values.length === this.variables.length) {
            let from = this.fa.getStart();

            for (let i=0; i<values.length; i++) {
                const to = this.fa.newState();
                this.fa.transition(from, values[i], to);
                from = to;
            }

            this.fa.setFinal(from);

            this.fa = this.fa.minimize();
        }
        else {
            throw new Error("The length of values must be the same as variables!");
        }
    }

    toDot () {
        return this.fa.toDot({
            toStringSymbol: (f, s, t) => utils.toString(this.zvs.getObject(this.zvs.branches.root, s))
        });
    }

    toJSON() {
        const json = this.fa.toJSON();
        // const json = this.fa.toJSON(s => this.zvs.getObject(this.zvs.branches.root, s));
        const c = v => this.zvs.getObject(this.zvs.branches.root, v);

        json.symbols = json.symbols.map(c)
        json.variables = this.variables.slice().map(c);

        json.transitions = json.transitions.map(
            ([from, symbolTos]) => [
                from, 
                symbolTos.map(
                    ([symbol, tos]) => [c(symbol), tos] 
                )
            ]
        );

        return {type: 'domains', data: json};
    }

    subtract (domain) {
        const fa = this.fa.subtract(domain.fa);
        return new Domains(this.zvs, [...this.variables], fa);
    }

    static fromJSON (zvs, domain) {
        if (domain.type === 'domains') {
            const c = v => zvs.data.add(v);

            domain = {...domain.data};
            domain.symbols = domain.symbols.map(c)
            domain.variables = domain.variables.map(c);

            domain.transitions = domain.transitions.map(
                ([from, symbolTos]) => [
                    from, 
                    symbolTos.map(
                        ([symbol, tos]) => [c(symbol), tos] 
                    )
                ]
            );

            const fa = FSA.fromJSON(domain);

            return new Domains(zvs, domain.variables, fa);
        }
    }

    split (variable, symbol) {
        let a = this.fa.minimize();
        let b = this.fa.minimize();

        const position = this.variables.indexOf(variable);
        const aStates = a.positionStates(position);

        // remove all symbols that are not symbol.
        for (let state of aStates) {
            const symbolTos = a.transitions.get(state);

            for (let s of symbolTos.keys()) {
                if (s !== symbol) {
                    symbolTos.delete(s);
                }
            }

            if (symbolTos.size === 0) {
                a.transitions.delete(state);
            }
        }

        a = a.minimize();

        // remove only the symbol.
        const bStates = b.positionStates(position);
        for (let state of bStates) {
            const symbolTos = b.transitions.get(state);

            symbolTos.delete(symbol);

            if (symbolTos.size === 0) {
                b.transitions.delete(state);
            }
        }
        
        b = b.minimize();

        return [
            new Domains(this.zvs, [...this.variables], a),  
            new Domains(this.zvs, [...this.variables], b)  
        ];
    }

    splitFilter () {
        // 1. forall variables,
        for (let variable of this.variables) {
            const symbols = this.getVariableSymbols(variable);

            if (symbols.size > 1) {
                // 2. check all symbol for variables or tuples.

                for (let symbol of symbols) {
                    // 3. if symbol is variable or tuple, then split:
                    const data = this.zvs.getData(this.zvs.branches.root, symbol);
                    const type = this.zvs.getData(this.zvs.branches.root, data.type);

                    if (type !== 'constant') {
                        const [a, b] = this.split(variable, symbol);

                        return a.splitFilter().concat(b.splitFilter());
                    }
                }
            }
            // else do nothing,
        }

        const variables = [];
        const removeVars = [];
        for (let variable of this.variables) {
            const symbols = this.getVariableSymbols(variable);

            // if variable as only one possible symbol,
            // then we should send them as a variable value to be merged on branch.
            if (symbols.size === 1) {
                const value = symbols.values().next().value;
                removeVars.push(variable);
                if (variable !== value) { 
                    variables.push({variable, value});
                }
            }
        }

        // remove all single value variables from Domains. 
        for (let i=0; i<removeVars.length; i++) {
            const variable = removeVars[i];
            this.remove(variable);
        } 

        return [{
            domain: this,
            variables
        }];
    }

    remove (variable) {
        const position = this.variables.indexOf(variable);
        const states = this.fa.positionStates(position);

        for (let state of states) {
            const symbolTos = this.fa.transitions.get(state);

            if (symbolTos) {
                let toStates = new Set();

                // state symbols, and collect the destination states.
                for (let [symbol, tos] of symbolTos) {
                    toStates = new Set([...toStates, ...tos]);
                    symbolTos.delete(symbol);
                }

                // copy all to's symbols to state.
                for (let to of toStates) {
                    const st = this.fa.transitions.get(to);

                    if (st) {
                        for (let [symbol, tos] of st) {
                            symbolTos.set(
                                symbol, 
                                new Set([...(symbolTos.get(symbol) || []), ...tos])
                            );
                        }
                    }

                    if (this.fa.finals.has(to)) {
                        this.fa.finals.add(state);
                    }
                }
            }
        }

        // remove variable,
        this.variables.splice(position, 1);

        // minimize fa,
        this.fa = this.fa.minimize();

        return this;
    }

    path (state, states) {
        const visited = new Set();
        const result = new Set();
        const process = [state];

        while (process.length) {
            const from = process.pop();

            if (states.has(from)) {
                result.add(from);
            }

            const symbolTos = this.fa.transitions.get(from);

            if (symbolTos) {
                for (let tos of symbolTos.values()) {
                    for (let to of tos) {
                        if (!visited.has(to)) {
                            process.push(to);
                        }
                    }
                }
            }
        }

        return result;
    }

    getVariableSymbols (variable) {
        const position = this.variables.indexOf(variable);

        return this.getSymbols(this.fa.positionStates(position));
    }

    getSymbols (froms) {
        let result = new Set();

        for (let from of froms) {
            const symbolTos = this.fa.transitions.get(from);

            if (symbolTos) {
                result = new Set([...result, ...symbolTos.keys()]);
            }
        }

        return result;
    }

    equalSymbol (variable, symbol, remove=true) {
        let aPosition = this.variables.indexOf(variable);

        const aStates = this.fa.positionStates(aPosition);

        for (let state of aStates) {
            const symbolTos = this.fa.transitions.get(state);

            for (let s of symbolTos.keys()) {
                if (symbol !== s) {
                    symbolTos.delete(s);
                }
            }
        }

        remove && this.remove(variable);

        return this;
    }

    equal (a, b) {
        let aPosition = this.variables.indexOf(a);
        let bPosition = this.variables.indexOf(b);

        if (aPosition > bPosition) {
            const tmpPosition = bPosition;
            const tmpVar = b;

            bPosition = aPosition;
            aPosition = tmpPosition;
            b = a;
            a = tmpVar;
        }

        const aStates = this.fa.positionStates(aPosition < bPosition?aPosition:bPosition);
        const bStates = this.fa.positionStates(aPosition < bPosition?bPosition:aPosition);

        // get all related states, from A to B, and from B to A.
        const reversedPaths = new Map();
        const paths = new Map();
        for (let aState of aStates) {
            const tos = this.path(aState, bStates);

            paths.set(aState, tos);

            for (let to of tos) {
                reversedPaths.set(
                    to,
                    new Set([...(reversedPaths.get(to) || []), aState])
                );
            }
        }

        // remove symbols from aState,
        for (let aState of aStates) {
            // 1.  get aState symbol,
            const aSymbols = this.getSymbols(new Set([aState]));

            // 2. get symbols from b states where is a path from aState to B.
            const bSymbols = this.getSymbols(paths.get(aState));

            // 3. Remove from aState all symbols that are not in aSymbols or bSymbols,
            const symbolTos = this.fa.transitions.get(aState);
            for (let symbol of symbolTos) {
                if (!aSymbols.has(symbol) || !bSymbols.has(symbol)) {
                    symbolTos.delete(symbol);
                }
            }
        }

        // remove symbols from bState,
        for (let bState of bStates) {
            // 1.  get aState symbol,
            const bSymbols = this.getSymbols(new Set([bState]));

            // 2. get symbols from b states where is a path from aState to B.
            const aSymbols = this.getSymbols(reversedPaths.get(bState));

            // 3. Remove from aState all symbols that are not in aSymbols or bSymbols,
            const symbolTos = this.fa.transitions.get(bState);
            for (let symbol of symbolTos) {
                if (!aSymbols.has(symbol) || !bSymbols.has(symbol)) {
                    symbolTos.delete(symbol);
                }
            }
        }

        // remove a,
        this.remove(a);

        /**
         * TODO:
         * - we don't know and we need to prove that removing/intersecting shared states does keep 
         * the consitency of domains.
         * 
         * I think removing a insted of b, is better because there is alredy branch unfolding on b,
         * and removing b insted of a would make to many brances to merge on a early stage. 
         * 
         * However both should be consistent since both will restrict paths, and a on a early stage it 
         * could be a good options to evaluate. 
         */

        return this;
    }

    equalShift(a, b) {
        const symbols = this.getVariableSymbols(b);

        // 1. inject equal variable a,
        this.variables.push(a);
        this.variables.sort();

        const position = this.variables.indexOf(a);

        // 1a. inject symbols,
        this.shift(position, symbols);

        // 2. for each symbol make a copy of domain leaving only 
        //    one symbol for each domain.
        const uDomain = new Domains(this.zvs, [...this.variables]);
        const jsonDomain = this.toJSON();
        for (let symbol of symbols) {
            const d = Domains.fromJSON(this.zvs, jsonDomain);

            d.equalSymbol(a, symbol, false);
            d.equalSymbol(b, symbol, false);

            // 3. make a union of all domains.
            uDomain.union(d);
        }

        // 4. replace fa,
        this.fa = uDomain.fa;

        return this;
    }

    intersect (domain) {
        this.fa = this.fa.intersect(domain.fa);

        return this;
    }

    union (domain) {
        this.fa = this.fa.union(domain.fa);

        return this;
    }

    shift (position, symbols) {
        const states = this.fa.positionStates(position);

        for (let state of states) {
            const symbolTos = this.fa.transitions.get(state);
            const s = this.fa.newState();

            if (symbolTos) {
                for (let [symbol, tos] of symbolTos) {
                    for (let to of tos) {
                        this.fa.transition(s, symbol, to);
                    }

                    symbolTos.delete(symbol);
                }
            }

            for (let symbol of symbols) {
                this.fa.transition(state, symbol, s);
            }
            // this.fa.transition(state, null, s);
        }
    }

    merge (vd) {
        const variables = vd.variables.slice();

        for (let i=0; i<this.variables.length; i++) {
            const v = this.variables[i];

            if (!variables.includes(v)) {
                variables.push(v);
            }
        }

        variables.sort();
        
        const a = new Domains(this.zvs, variables, this.fa.minimize());
        const b = new Domains(this.zvs, variables, vd.fa.minimize());

        for (let i=0; i<variables.length; i++) {
            const v = variables[i];

            if (!this.variables.includes(v)) {
                const symbols = b.getVariableSymbols(v);
                a.shift(i, symbols);
            }

            if (!vd.variables.includes(v)) {
                const symbols = a.getVariableSymbols(v);
                b.shift(i, symbols);
            }
        }

        const aFinals = a.fa.positionStates(variables.length);
        const bFinals = b.fa.positionStates(variables.length);

        a.fa.finals = new Set([...aFinals]);
        b.fa.finals = new Set([...bFinals]);
        
        const u = a.fa.intersect(b.fa);

        for (let symbolTos of u.transitions.values()) {
            symbolTos.delete(null);
        }

        return new Domains(this.zvs, variables, u.minimize());
    } 

    isEmpty () {
        this.fa.minimize();
        return this.fa.transitions.size === 0;
    }
}


module.exports = Domains;
