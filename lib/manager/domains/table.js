const CSet = require("cset");
const IdenticObjects = require("identicobjects");

function *combinations (header) {
    if (header.length) {
        const io = new IdenticObjects();
        const h = new CSet(header.sort());
        let s = h.as("s0");

        yield header.map(v => io.get([v])).sort();

        const dup = new Set();
        for (let i=1; i<header.length; i++) {
            s = s.distinctCartesianProduct(h.as(`s${i}`));

            for (let e of s.values()) {
                const remain = header.filter(v => !e.includes(v)).sort();

                e.sort();
                if (remain.length) {
                    for (let r of combinations(remain)) {
                        const d = io.get([e].concat(r).sort());

                        if (!dup.has(d)) {
                            dup.add(d);
                            yield d;
                        }
                    }
                }
                else {
                    const d = io.get(e);
                    if (!dup.has(d)) {
                        dup.add(d);
                        yield [d];
                    }
                }
            }
        }
    }
    else {
        return [];
    }
}

const equalCoinstrain = {
    name: "=",
    predicate: (a, b) => a === b
};


function getSet (vs, domains) {
    let r;

    for (let i=0; i<vs.length; i++) {
        // Equal Variables,
        let eq;
        const e = vs[i];

        for (let i=0; i<e.length; i++) {
            const a = e[i];
            const se = new CSet(domains.get(a));

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
                const ca = se.cartesianProduct(eq.as(a));

                se = ca.constrain([a, b], equalCoinstrain);
            }
            else {
                se = eq.as(a);
            }
        }

        if (r) {
            if (se.count() === 1) {
                r = r.cartesianProduct(se);
            }
            else {
                r = r.distinctCartesianProduct(se);
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

function getDomains (header, s) {
    const domains = new Map();

    for (let i=0; i<header.length; i++) {
        const a = header[i];

        const domain = s.domain(a);

        domains.set(a, domain);
    }

    return domains;
}

function toENE (header, s, max, i=0) {

    // console.log(i, max, s.count());
    if (s.isEmpty()) {
        return {s, solution: [], count: i};
    }

    if (i>max) {
        return;
    }

    const domains = getDomains(header, s);

    let result;

    for (let vs of combinations(header)) {
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

                        // TODO: if we remove * 0.5, it may not find optimal solution, thats wrong.
                        // max = count * 0.5;
                        max = count;
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

    const sCount = i + s.count();
    
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

const notEqualPred = {
    name: "<>",
    predicate: (a, b) => a !== b
};

class Table {

    constructor (header, s) {
        this.header = header;
        this.s = s || new CSet([]);
        this.counter = 0;
    }

    addRow (data) {
        this.counter++;
        let r;
        for (let i=0; i<this.header.length; i++) {
            const a = data[i];
            const h = this.header[i];

            const s = new CSet([a]).as(h);

            r = r?r.cartesianProduct(s):s;
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

            const a = new CSet(values instanceof Array?values:[values]).as(v);
            d = d?d.cartesianProduct(a):a;

            if (values instanceof Array) {
                for (let i=0; i<diff.length; i++) {
                    const df = diff[i];

                    d = d.constrain([df, v], notEqualPred);
                }

                diff.push(v);
            }
        }

        this.s = this.s.union(d);
    }

    isEmpty () {
        return this.s.isEmpty();
    }

    sameIntersectSingles (domains, intersects, singleA, singleB) {
        let s;

        const singleDomains = new Map([
            ...domains,
            ...singleA,
            ...singleB
        ]);

        for (let [id, domain] of singleDomains) {
            const d = new CSet(domain).as(id);
            s = s?s.cartesianProduct(d):d;
        }

        for (let [id, domain] of intersects) {
            let d;
            for (let i=0; i<domain.length; i++) {
                const ds = new CSet(domain[i]);
                d = d?d.intersect(ds):d;
            }

            d.as(id);

            s = s?s.cartesianProduct(d):d;
        }

        // intersect are all diff.
        const diff = [...domains.keys(), ...intersects.keys()]
        for (let i=0; i<diff.length-1; i++) {
            const a = diff[i];
            for (let j=i+1; j<diff.length; j++) {
                const b = diff[j];

                s.constrain([a, b], {
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

                s.constrain([a, b], {
                    name: "<>",
                    predicate: (a, b) => a !== b
                });
            }
        }

        for (let i=0; i<diffA.length; i++) {
            const a = diffA[i];

            for (let i=0; i<diff.length; i++) {
                const b = diff[i];

                s.constrain([a, b], {
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

                s.constrain([a, b], {
                    name: "<>",
                    predicate: (a, b) => a !== b
                });
            }
        }

        for (let i=0; i<diffB.length; i++) {
            const a = diffB[i];

            for (let i=0; i<diff.length; i++) {
                const b = diff[i];

                s.constrain([a, b], {
                    name: "<>",
                    predicate: (a, b) => a !== b
                });
            }
        }

        /*
        console.log(" ----- Values -----");
        console.log(JSON.stringify(this.header));
        for (let e of s.values()) {
            console.log(JSON.stringify(e));
        }*/

        this.s = this.s.union(s);
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
