const {CSetArray} = require("cset");
const IdenticObjects = require("identicobjects");

/*
function *powerSet(header, rs) {
    if (header.length) {
        const io = new IdenticObjects();
        const result = [[]];
        const dups = new Set();

        for (let i=0; i<header.length; i++){
        // this line is crucial! It prevents us from infinite loop
            const len = result.length; 
            for (let x=0; x<len ;x++){
                const r = result[x].concat(header[i]).sort();
                const remain = header.filter(v => !r.includes(v));

                const es = rs.select(r, {
                    name: "*=*",
                    predicate: (...args) => new Set(args).size === 1
                });
                
                if (!es.isEmpty()) {
                    result.push(r);

                    if (remain.length) {
                        for (let p of powerSet(remain, es)) {
                            const d = [r].concat(p);
                            const e = io.get(d.map(v => io.get(v)).sort());

                            if (!dups.has(e)) {
                                dups.add(e);
                                yield d;
                            }
                        }
                    }
                    else {
                        yield [r];
                    }
                }
            }
        }
    }
}*/

function *powerSet(header) {
    if (header.length) {
        const io = new IdenticObjects();
        const result = [[]];
        const dups = new Set();

        for (let i=0; i<header.length; i++){
        // this line is crucial! It prevents us from infinite loop
            const len = result.length; 
            for (let x=0; x<len; x++){
                const r = result[x].concat(header[i]).sort();
                const remain = header.filter(v => !r.includes(v));

                result.push(r);

                if (remain.length) {
                    for (let p of powerSet(remain)) {
                        const d = [r].concat(p);
                        const e = io.get(d.map(v => io.get(v)).sort());

                        if (!dups.has(e)) {
                            dups.add(e);
                            yield d;
                        }
                    }
                }
                else {
                    yield [r];
                }
            }
        }
    }
}

const equalCoinstrain = {
    name: "=",
    predicate: (...args) => new Set(args).size === 1
};

function distinctCartesianProduct (a, b) {
    const ab = a.crossProduct(b); 
    return ab.select(
        ab.header,
        {
            name: "<>",
            predicate: (...args) => new Set(args).size === args.length
        }
    );
}

/*
function getSet (vs, domains) {
    let r;

    for (let i=0; i<vs.length; i++) {
        // Equal Variables,
        let eq;
        const e = vs[i];

        for (let i=0; i<e.length; i++) {
            const a = e[i];
            const se = new CSetArray(domains.get(a));

            if (eq) {
                eq = eq.intersect(se);
            }
            else {
                eq = se;
            }
        }

        if (eq.isEmpty()) {
            return;
        }

        let se;
        for (let i=0; i<e.length; i++) {
            const a = e[i];

            if (se) {
                const b = e[i-1];
                const ca = se.crossProduct(eq.as(a));

                se = ca.select([a, b], equalCoinstrain);
            }
            else {
                se = eq.as(a);
            }
        }

        if (r) {
            if (se.count() === 1) {
                r = r.crossProduct(se);
            }
            else {
                r = distinctCartesianProduct(r, se);
            }

            if (r.isEmpty()) {
                return;
            }
        }
        else {
            r=se;
        }
    }

    return r;
}
*/

function getSet (vs, domains) {
    let r;
    let headers = [];
    
    for (let i=0; i<vs.length; i++) {

        const eq = vs[i];
        let equals;
        let header = eq[0];
        let isConstant = false;

        if (eq.length > 1) {
            // make the intersect of equal sets/variables,
            let s;
            for (let i=0; i<eq.length; i++) {
                const h = eq[i];
                const ha = new CSetArray(domains.get(h));

                s = s?s.intersect(ha):ha;
            }

            let count = s?s.count():0;

            if (count === 0) {
                return;
            }

            isConstant = count === 1;

            // if all sets intersect, then
            // make the cross product where they are equal.
            let se;
            for (let i=0; i<eq.length; i++) {
                const h = eq[i];
    
                const a = s.as(h);

                if (se) {
                    const ca = se.crossProduct(a);
                    se = ca.select(ca.header, equalCoinstrain);
                }
                else {
                    se = a;
                }
            }

            equals = se;
        }
        else {
            equals = new CSetArray(domains.get(header)).as(header);
            isConstant = equals.count() === 1;
        }

        r = r?r.crossProduct(equals):equals;

        if (!isConstant) {
            headers.push(header);

            if (headers.length > 1) {
                r = r.select(
                    headers,
                    {
                        name: "<>",
                        predicate: (...args) => new Set(args).size === args.length
                    }        
                );
            }
        }
    }

    return r;
}

function getDomains (header, s) {
    const domains = new Map();

    for (let i=0; i<header.length; i++) {
        const a = header[i];

        const domain = [...s.projection(a).values()];

        domains.set(a, domain);
    }

    return domains;
}

function toENE (header, s, max, i=0) {
    if (s.isEmpty()) {
        return {s, solution: [], count: i?i-1:0};
    }

    if (i<=max) {
        /**
         * If we are still bellow max,
         * try to compress more.
         */
        const domains = getDomains(header, s);
        let result;

        for (let vs of powerSet(header, s)) {
            const r = getSet(vs, domains);

            /*
            if (r) {
                console.log(
                    i, max, 
                    "VS => " + JSON.stringify(vs),
                    "R => " + JSON.stringify([...r.values()]),
                    "S => " + JSON.stringify([...s.values()]),
                    "Is subset " + (r.isSubset(s)?"yes":"no")
                );
            }
            else {
                console.log(
                    i, max, 
                    "VS => " + JSON.stringify(vs),
                    "R is undefined!",
                    "S => " + JSON.stringify([...s.values()]),
                );
            }*/

            if (r && r.isSubset(s)) {
                /*
                console.log(
                    i, max, 
                    "VS => " + JSON.stringify(vs),
                    "R => " + JSON.stringify([...r.values()]),
                    "S => " + JSON.stringify([...s.values()])
                );*/

                const ene = toENE(header, s.difference(r), max, i+1);
                
                const rDomains = getDomains(r.header, r);

                if (ene && ene.solution) {
                    const {s, solution, count} = ene;

                    result = {
                        s: r.union(s),
                        solution: [{
                            variables: vs,
                            domains: [...rDomains]
                        }].concat(solution),
                        count
                    };

                    max = count; //  * 0.5;
                }
            }
        }

        if (result) {
            return result;
        }
    }

    /**
     * If no result send remain as constants
     */
    const sc = s.count();
    const sCount = i + sc;

    if (sCount <= max) {
        const rest = [];
        for (let e of s.values()) {
            rest.push({
                variables: header.map(h => [h]),
                domains: header.map((h, i) => ([h, [e[i]]]))
            });
        }

        return {
            s,
            solution: rest,
            count: sCount
        };
    }
}
/*
function toENE (header, s, max, i=0) {

    if (s.isEmpty()) {
        return {s, solution: [], count: i?i-1:0};
    }

    if (i<=max) {

        const domains = getDomains(header, s);

        let result;

        for (let vs of powerSet(header, s)) {
            const r = getSet(vs, domains);

            if (r) {
                const rs = r.intersect(s);
                
                if (!rs.isEmpty()) {
                    const rDomains = getDomains(header, rs);
                    const rd = getSet(vs, rDomains);

                    if (rd && rd.isSubset(s)) {
                        const ene = toENE(header, s.difference(rd), max, i+1);
                        if (ene && ene.solution) {
                            const {s, solution, count} = ene;

                            result = {
                                s: rd.union(s),
                                solution: [{
                                    variables: vs,
                                    domains: [...rDomains]
                                }].concat(solution),
                                count
                            };

                            max = count; //  * 0.5;
                        }
                        else {
                            continue;
                        }
                    }
                }
            }
        }

        if (result) {
            return result;
        }
    }

    const sc = s.count();
    const sCount = i + sc;

    if (sCount <= max) {
        const rest = [];
        for (let e of s.values()) {
            rest.push({
                variables: header.map(h => [h]),
                domains: header.map((h, i) => ([h, [e[i]]]))
            });
        }

        return {
            s,
            solution: rest,
            count: sCount
        };
    }
}*/

const notEqualPred = {
    name: "<>",
    predicate: (a, b) => a !== b
};

class Table {

    constructor (header, s) {
        this.header = header;
        this.s = s;  // || new CSetArray([]);
        this.counter = 0;

    }

    addRow (data) {
        this.counter++;
        let r;
        for (let i=0; i<this.header.length; i++) {
            const a = data[i];
            const h = this.header[i];

            const s = new CSetArray([a]).as(h);

            r = r?r.crossProduct(s):s;
        }

        this.s = this.s?this.s.union(r):r;
    }

    toENE () {
        const ene = toENE(this.header, this.s, this.s.count());
        if (ene) {
            this.s = ene.s;
        }

        return ene;
    }

    symmetricDifference (t) {
        return new Table(this.header, this.s.symmetricDifference(t.s));
    }

    intersect (t) {
        return new Table(this.header, this.s.intersect(t.s));
    }

    addENERow (domains) {
        let d;

        const diff = [];
        for (let i=0; i<domains.length; i++) {
            const [v, values] = domains[i];

            const a = new CSetArray(values instanceof Array?values:[values]).as(v);
            d = d?d.crossProduct(a):a;

            if (values instanceof Array) {
                for (let i=0; i<diff.length; i++) {
                    const df = diff[i];

                    d = d.select([df, v], notEqualPred);
                }

                diff.push(v);
            }
        }

        this.s = this.s?this.s.union(d):d;
    }

    isEmpty () {
        return !this.s || this.s.isEmpty();
    }

    sameIntersectSingles (domains, intersects, singleA, singleB) {
        let s;

        const singleDomains = new Map([
            ...domains,
            ...singleA,
            ...singleB
        ]);

        for (let [id, domain] of singleDomains) {
            const d = new CSetArray(domain).as(id);
            s = s?s.crossProduct(d):d;
        }

        for (let [id, domain] of intersects) {
            let d;
            for (let i=0; i<domain.length; i++) {
                const ds = new CSetArray(domain[i]);

                d = d?d.intersect(ds):ds;
            }

            d = d.as(id);

            s = s?s.crossProduct(d):d;
        }

        // intersect are all diff.
        const diff = [...domains.keys(), ...intersects.keys()];
        for (let i=0; i<diff.length-1; i++) {
            const a = diff[i];
            for (let j=i+1; j<diff.length; j++) {
                const b = diff[j];

                s = s.select([a, b], {
                    name: "<>",
                    predicate: (a, b) => a !== b
                });
            }
        }

        const diffA = [...singleA.keys()];
        for (let i=0; i<diffA.length-1; i++) {
            const a = diffA[i];
            for (let j=i+1; j<diffA.length; j++) {
                const b = diffA[j];

                s = s.select([a, b], {
                    name: "<>",
                    predicate: (a, b) => a !== b
                });
            }
        }

        for (let i=0; i<diffA.length; i++) {
            const a = diffA[i];

            for (let i=0; i<diff.length; i++) {
                const b = diff[i];

                s = s.select([a, b], {
                    name: "<>",
                    predicate: (a, b) => a !== b
                });
            }
        }

        const diffB = [...singleB.keys()];
        for (let i=0; i<diffB.length-1; i++) {
            const a = diffB[i];
            for (let j=i+1; j<diffB.length; j++) {
                const b = diffB[j];

                s = s.select([a, b], {
                    name: "<>",
                    predicate: (a, b) => a !== b
                });
            }
        }

        for (let i=0; i<diffB.length; i++) {
            const a = diffB[i];

            for (let i=0; i<diff.length; i++) {
                const b = diff[i];

                s = s.select([a, b], {
                    name: "<>",
                    predicate: (a, b) => a !== b
                });
            }
        }

        this.s = this.s?this.s.union(s):s;
    }

    *eneBranches (zvs, ene, parentBranchId, branches, action, tupleId) {
        const DOMAINS_ID = zvs.data.global("domains");

        for (let i=0; i<ene.solution.length; i++) {
            const es = ene.solution[i];
    
            const { branchId: newBranchId } = zvs.branches.getId({
                parent: parentBranchId,
                args: {
                    branches: [...branches],
                    solution: es
                },
                action
            });
    
            const domains = new Map(es.domains);
            const branchDomains = [];
                
            for (let i=0; i<es.variables.length; i++) {
                const vars = es.variables[i];
                const vID = vars[0];
    
                const d = domains.get(vID);
                let valueID;
    
                if (d.length > 1) {
                    // value is a domain,
                    const dData = zvs.getData(parentBranchId, vID);
                    const dID = zvs.getData(parentBranchId, dData.id);
                    const domain = {
                        type: "domain",
                        data: d.map(v => zvs.getObject(parentBranchId, v)),
                        id: dID
                        // TODO: this should have foward change field ?? 
                    };
    
                    valueID = zvs.data.add(domain);
    
                    // add new domain to branch.
                    branchDomains.push(domain);
                }
                else {
                    valueID = zvs.data.add(zvs.getObject(parentBranchId, d[0]));
                }
    
                for (let i=0; i<vars.length; i++) {
                    // make equal variables,
                    const v = vars[i];

                    zvs.branches.transform(newBranchId, v, valueID);
                }
            }
    
            zvs.branches.transform(
                newBranchId, 
                DOMAINS_ID, 
                zvs.data.add({
                    type: "domains",
                    data: branchDomains,
                    // TODO: check change field name.
                    change: newBranchId
                })
            );
    
            if (tupleId) {
                zvs.update(newBranchId, tupleId, {check: true});
            }
    
            yield newBranchId;
        }
    }
}

module.exports = Table;
