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

                        max = count * 0.5;
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

        for (let i=0; i<domains.length; i++) {
            const [v, values] = domains[i];

            if (values instanceof Array) {
                // distinct cartesian product,
                const a = new CSet(values).as(v);

                d = d?d.distinctCartesianProduct(a):a;
            }
            else {
                // cartesian product,
                const a = new CSet([values]).as(v);
                d = d?d.cartesianProduct(a):a;
            }
        }

        this.s = this.s.union(d);
    }

    isEmpty () {
        return this.s.isEmpty();
    }
}

/*
const t = new Table(["a", "b", "c"]);

t.addRow([0, 0, 0]);
t.addRow([0, 1, 0]);
t.addRow([1, 0, 0]);
t.addRow([1, 1, 1]);

t.toENE();

if (t.s) {
    console.log("Found Set!!");

    for (let e of t.s.values()) {
        console.log(e);
    }
}

const tn = new Table(["a", "b", "c", "d"]);

for (let i=0; i<100; i++) {
    tn.addRow([
        Math.floor(Math.random()*3),
        Math.floor(Math.random()*3),
        Math.floor(Math.random()*3),
        Math.floor(Math.random()*3)
    ]);
}

for (let e of tn.s.values()) {
    console.log(JSON.stringify(e));
}

console.log("---- TO ENE --"); 

tn.toENE();
*/

module.exports = Table;
