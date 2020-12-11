const { CSetArray } = require("cset");
const IdenticObjects = require("identicobjects");

function seedSets(header, s) {
    const total = s.count();

    const equals = [];
    const potencialDiff = [];

    for (let i = 0; i < header.length; i++) {
        const a = header[i];

        for (let j = i + 1; j < header.length; j++) {
            const b = header[j];

            const ab = s.select(
                [a, b], {
                    name: "=",
                    predicate: (a, b) => a === b
                }
            );

            const abCount = ab.count();

            if (abCount > 0) {
                equals.push({
                    domains: [a, b],
                    count: abCount
                    /*,
                    s,
                    subset: ab*/
                });
            }

            const abDiffCount = total - abCount;

            if (abDiffCount > 1) {
                /**
                 * This are potenticial diff sets because they 
                 * have not been tested with extracted domains.
                 */
                potencialDiff.push({
                    domains: [a, b],
                    count: total - abCount
                });
            }
        }
    }

    return { equals, notEquals: potencialDiff };
}

function nHeaderSets(header, twoHeaderSets, test) {
    const nSets = twoHeaderSets.slice();
    let step = nSets.slice();

    for (let i = 2; i < header.length && step.length; i++) {
        const nStep = [];

        for (let j = 0; j < step.length - 1; j++) {
            const a = step[j];

            const stats = {};

            for (let k = j + 1; k < step.length; k++) {
                const b = step[k];

                const c = b.filter(v => !a.includes(v));

                if (c.length === 1) {
                    const h = c[0];
                    const n = stats[h] = (stats[h] || 0) + 1;

                    if (n === i) {
                        const hs = [...a, h].sort();

                        if (test(hs)) {
                            nSets.push(hs);
                            nStep.push(hs);
                        }
                    }
                }
            }
        }

        step = nStep;
    }

    return nSets;
}

function nSetsCombinations(header, s) {

    const { equals, notEquals } = seedSets(header, s);

    /*
    let step = equals.map(v => v.domains);

    const sets = step.slice();
    for (let i=2; i<header.length && step.length; i++) {
        const nStep = [];

        for (let j=0; j<step.length-1; j++) {
            const a = step[j];

            const stats = {};

            for (let k=j+1; k<step.length; k++) {
                const b = step[k];

                const c = b.filter(v => !a.includes(v));

                if (c.length === 1) {
                    const h = c[0];
                    const n = stats[h] = (stats[h] || 0) + 1;

                    if (n === i) {
                        const hs = [...a, h].sort();
                        const testSet = s.select(hs, {
                            name: "<*>",
                            predicate: (...args) => new Set(args).size === 1
                        });

                        if (!testSet.isEmpty()) {
                            sets.push(hs);
                            nStep.push(hs);
                        }
                    }
                }
            }
        }

        step = nStep;
    }*/
    const equalSets = nHeaderSets(header, equals.map(v => v.domains), hs =>
        !s.select(hs, {
            name: "=*",
            predicate: (...args) => new Set(args).size === 1
        }).isEmpty()
    );

    const notEqualSets = nHeaderSets(header, notEquals.map(v => v.domains), hs =>
        !s.select(hs, {
            name: "*<>*",
            predicate: (...args) => new Set(args).size === args.length
        }).isEmpty()
    );
}

function* combinations(header, s) {
    if (header.length) {
        const io = new IdenticObjects();
        const result = [[]];
        const dups = new Set();

        for (let i = 0; i < header.length; i++) {
            // this line is crucial! It prevents us from infinite loop
            const len = result.length;
            for (let x = 0; x < len; x++) {
                const r = result[x].concat(header[i]).sort();
                const remain = header.filter(v => !r.includes(v));

                result.push(r);

                if (remain.length) {
                    for (let p of combinations(remain)) {
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

/*
function *powerSet(header, s) {

    const sets = [];
    for (let i=0; i<header.length; i++) {
        const a = header[i];

        for (let j=i+1; j<header.length; j++) {
            const b = header[i];

            const ab = s.projection(a, b);
            const aDomains = ab.getDomains(a);
            const bDomains = ab.getDomains(b);

            for (let da of subsets(aDomains)) {
                const as = new CSetArray(da);

                // we need to make subset function to not return sets with a min elements.
                if (da.length > 1) {
                    for (let db of subsets(bDomains)) {
                        const bs = new CSetArray(db);

                        const aNEb = as.crossProduct(bs).select(
                            [a, b], {
                                name: "<>",
                                predicate: (a, b) => a !== b
                            }
                        );

                        if (!aNEb.isEmpty() && aNEb.isSubset(ab)) {
                            // This is a valid not equal subset.
                            sets.push({
                                da,
                                db,
                                aNEb
                            });
                        }
                    }
                }
            }
        }
    }
}*/


/*
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
*/

const notEqualPred = {
    name: "<>",
    predicate: (a, b) => a !== b
};

const equalCoinstrain = {
    name: "=",
    predicate: (...args) => new Set(args).size === 1
};

function getSet(vs, domains) {
    let r;
    let headers = [];

    for (let i = 0; i < vs.length; i++) {

        const eq = vs[i];
        let equals;
        let header = eq[0];
        let isConstant = false;

        if (eq.length > 1) {
            // make the intersect of equal sets/variables,
            let s;
            for (let i = 0; i < eq.length; i++) {
                const h = eq[i];
                const ha = new CSetArray(domains.get(h));

                s = s ? s.intersect(ha) : ha;
            }

            let count = s ? s.count() : 0;

            if (count === 0) {
                return;
            }

            isConstant = count === 1;

            // if all sets intersect, then
            // make the cross product where they are equal.
            let se;
            for (let i = 0; i < eq.length; i++) {
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

        r = r ? r.crossProduct(equals) : equals;

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

function getDomains(header, s) {
    let startTime = new Date().getTime();

    const domains = new Map();

    for (let i = 0; i < header.length; i++) {
        const a = header[i];

        const domain = [...s.projection(a).values()];

        domains.set(a, domain);
    }

    return domains;
}

function toENE(header, s, max, i = 0) {
    if (s.isEmpty()) {
        return { s, solution: [], count: i ? i - 1 : 0 };
    }

    if (i <= max) {
        /**
         * If we are still bellow max,
         * try to compress more.
         */
        const domains = getDomains(header, s);

        let result;

        let startTime = new Date().getTime();

        nSetsCombinations(header, s);

        for (let vs of combinations(header, s)) {
            const r = getSet(vs, domains);

            if (r && r.isSubset(s)) {
                const remain = s.difference(r);
                const ene = toENE(header, remain, max, i + 1);

                if (ene && ene.solution) {
                    const rDomains = getDomains(r.header, r);
                    const { s, solution, count } = ene;

                    result = {
                        s: r.union(s),
                        solution: [{
                            variables: vs,
                            domains: [...rDomains]
                        }].concat(solution),
                        count
                    };

                    max = count - 1;

                    if (max === 0) {
                        return result;
                    }
                }
            }

            startTime = new Date().getTime();
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

class Table {

    constructor(header, s) {
        this.header = header;
        this.s = s;  // || new CSetArray([]);
        this.counter = 0;
    }

    addRow(data) {
        this.counter++;
        let r;
        for (let i = 0; i < this.header.length; i++) {
            const a = data[i];
            const h = this.header[i];

            const s = new CSetArray([a]).as(h);

            r = r ? r.crossProduct(s) : s;
        }

        this.s = this.s ? this.s.union(r) : r;
    }

    toENE() {
        const ene = toENE(this.header, this.s, this.s.count());
        if (ene) {
            this.s = ene.s;
        }

        return ene;
    }

    symmetricDifference(t) {
        return new Table(this.header, this.s.symmetricDifference(t.s));
    }

    intersect(t) {
        return new Table(this.header, this.s.intersect(t.s));
    }

    addENERow(domains) {
        let d;

        const diff = [];
        for (let i = 0; i < domains.length; i++) {
            const [v, values] = domains[i];

            const a = new CSetArray(values instanceof Array ? values : [values]).as(v);
            d = d ? d.crossProduct(a) : a;

            if (values instanceof Array) {
                for (let i = 0; i < diff.length; i++) {
                    const df = diff[i];

                    d = d.select([df, v], notEqualPred);
                }

                diff.push(v);
            }
        }

        this.s = this.s ? this.s.union(d) : d;
    }

    isEmpty() {
        return !this.s || this.s.isEmpty();
    }

    sameIntersectSingles(domains, intersects, singleA, singleB) {
        let s;

        const singleDomains = new Map([
            ...domains,
            ...singleA,
            ...singleB
        ]);

        for (let [id, domain] of singleDomains) {
            const d = new CSetArray(domain).as(id);
            s = s ? s.crossProduct(d) : d;
        }

        for (let [id, domain] of intersects) {
            let d;
            for (let i = 0; i < domain.length; i++) {
                const ds = new CSetArray(domain[i]);

                d = d ? d.intersect(ds) : ds;
            }

            d = d.as(id);

            s = s ? s.crossProduct(d) : d;
        }

        // intersect are all diff.
        const diff = [...domains.keys(), ...intersects.keys()];
        for (let i = 0; i < diff.length - 1; i++) {
            const a = diff[i];
            for (let j = i + 1; j < diff.length; j++) {
                const b = diff[j];

                s = s.select([a, b], {
                    name: "<>",
                    predicate: (a, b) => a !== b
                });
            }
        }

        const diffA = [...singleA.keys()];
        for (let i = 0; i < diffA.length - 1; i++) {
            const a = diffA[i];
            for (let j = i + 1; j < diffA.length; j++) {
                const b = diffA[j];

                s = s.select([a, b], {
                    name: "<>",
                    predicate: (a, b) => a !== b
                });
            }
        }

        for (let i = 0; i < diffA.length; i++) {
            const a = diffA[i];

            for (let i = 0; i < diff.length; i++) {
                const b = diff[i];

                s = s.select([a, b], {
                    name: "<>",
                    predicate: (a, b) => a !== b
                });
            }
        }

        const diffB = [...singleB.keys()];
        for (let i = 0; i < diffB.length - 1; i++) {
            const a = diffB[i];
            for (let j = i + 1; j < diffB.length; j++) {
                const b = diffB[j];

                s = s.select([a, b], {
                    name: "<>",
                    predicate: (a, b) => a !== b
                });
            }
        }

        for (let i = 0; i < diffB.length; i++) {
            const a = diffB[i];

            for (let i = 0; i < diff.length; i++) {
                const b = diff[i];

                s = s.select([a, b], {
                    name: "<>",
                    predicate: (a, b) => a !== b
                });
            }
        }

        this.s = this.s ? this.s.union(s) : s;
    }
}

module.exports = Table;
