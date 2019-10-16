const {CSetArray} = require("cset");
const IdenticObjects = require("identicobjects");

const eneStats = {
    getDomains: {
        time: 0,
        count: 0
    },
    powerSet: {
        time: 0,
        count: 0
    }
};

setInterval(() => {
    console.log(`PowerSet: Time=${(eneStats.powerSet.time/(1000*60)).toFixed(3)}m, Count=${eneStats.powerSet.count}, Avg=${((eneStats.powerSet.time/eneStats.powerSet.count)/(1000*60)).toFixed(3)}m`);
    console.log(`GetDomains: Time=${(eneStats.getDomains.time/(1000*60)).toFixed(3)}m, Count=${eneStats.getDomains.count}, Avg=${((eneStats.getDomains.time/eneStats.getDomains.count)/(1000*60)).toFixed(3)}m`);
}, 1000 * 3);

/*

*/

function *powerSet (array, offset = 0) {
    while (offset < array.length) {
      let first = array[offset++];
      for (let subset of powerSet(array, offset)) {
        subset.push(first);
        yield subset;
      }
    }

    yield [];
}

/*
    1. Make all combinations of 2 equal variables (A, B), test for empty set.
    2. For each combination A = B, get A != B using count:
        a. Ex. Total=4; A = B => 2 then A != B => Total - 2 => 2.
    3. Validate all non-equal sets:
        a. extract domains,
        b. make all domains combinations including constants, 
        c. test all resulting sets (is not empty, is a subset of non-equal set)
        b. update all counting.
    4. Make +1 combinations (Also for non-equals?):
        a. for equal variables (A, B) exists (A, B, C) iff (A, C) and (B, C)
        b. for equal variables (A, B, C) exists (A, B, C, D) iff (A, B, D) and (A, C, D) and (B, C, D),
        c. we keep add combinations until the is no more variables to add.
    5. Domains with only one variable are constants,
    6. If some set combination of variable names are not full, then the remaining variables are constants.
    7. Make all combinations (union) of sets that do not intersect, count the final set values and calc the remaining values (R) that 
    should be constant. 
    8. The total number of unions + R is the final score of the set, choose the one with min score. 
*/

/*
// TOOD: this will actually work for equal/diff etc...
function *notEqualSetCombinator (s, header, hs, domains) {
    const ts = hs.slice();
    const h = ts.pop();
    const ds = domains[h];
    
    for (let i=0; i<ds.length; i++) {
        const {s, header, domains} = ds[i];

        if (ts.length === 0) {
            yield {
                s,
                dhs: [header],
                domains
            };
        }
        else {
            for (let tail of notEqualSetCombinator (s, header, ts, domains)) {
                const headerTail = tail.s.header;
                let rs = s.crossProduct(tail.s);
    
                for (let i=0; i<header.length; i++) {
                    const a = header[i];

                    for (let j=0; j<headerTail.length; j++) {
                        const b = headerTail[j];

                        rs = rs.select([a, b], {
                            name: "<>",
                            predicate: (a, b) => a !== b
                        });
                    }
                }

                const headerAll = header.concat(headerTail);
                const ps = s.projection(...headerAll);

                if (!rs.isEmpty() && rs.isSubset(ps)) {
                    yield {
                        s: rs,
                        dhs: tail.dhs.concat(header),
                        domains
                    };
                }
            }
        }
    }
}*/

function *notEqualSetCombinator (s, header, hs, domains) {
    const ts = hs.slice();
    const h = ts.pop();
    const ds = domains[h];
    
    for (let i=0; i<ds.length; i++) {
        const {s, header, domains} = ds[i];

        if (ts.length === 0) {
            yield {
                s,
                dhs: [header],
                domains
            };
        }
        else {
            for (let tail of notEqualSetCombinator (s, header, ts, domains)) {
                const headerTail = tail.s.header;
                let rs = s.crossProduct(tail.s);
    
                for (let i=0; i<header.length; i++) {
                    const a = header[i];

                    for (let j=0; j<headerTail.length; j++) {
                        const b = headerTail[j];

                        rs = rs.select([a, b], {
                            name: "<>",
                            predicate: (a, b) => a !== b
                        });
                    }
                }

                const headerAll = header.concat(headerTail);
                const ps = s.projection(...headerAll);

                if (!rs.isEmpty() && rs.isSubset(ps)) {
                    yield {
                        s: rs,
                        dhs: tail.dhs.concat(header),
                        domains
                    };
                }
            }
        }
    }
}

function *selectNotEqualSet (s, hs) {
        // const [a, b] = hs;

        // 1. create not set,
        const neqAB = s.projection(...hs).select(hs, {
            name: "<>",
            predicate: (...args) => new Set(args).size === args.length
        });

        const domains = {};
        for (let i=0; i<hs.length; i++) {
            const h = hs[i]
            domains[h] = [...powerSet([...neqAB.projection(h).values()])].filter(v => v.length > 1).map(ds => ({
                s: new CSetArray(ds).as(h),
                header: h,
                domain: ds
            }));
        }

        /*
        console.log("DOMAINS => " + JSON.stringify(domains));

        // 2. extract domains,
        const aDomains = [...neqAB.projection(a).values()];
        const bDomains = [...neqAB.projection(b).values()];

        // 3. create domains powerSet,
        for (let domainA of powerSet(aDomains)) {
            // TODO: make powerset always return a min of two elems sets.
            if (domainA.length > 1) {
                const setA = new CSetArray(domainA).as(a);

                for (let domainB of powerSet(bDomains)) {
                    if (domainB.length > 1) {

                        const setB = new CSetArray(domainB).as(b);
                        const setAB = setA.crossProduct(setB).select([a, b], {
                            name: "<>",
                            predicate: (a, b) => a !== b
                        });

                        const count = setAB.count();
                        if (count > 1 && setAB.isSubset(neqAB)) {
                            // Set is ok, add it.
                            yield {
                                domains: [a, b],
                                domainA,
                                domainB,
                                count,
                                s,
                                subset: setAB
                            };
                        }
                    }
                }
            }
        }*/
}

/**
    TODO:
        Not equal sets depends on domain extraction, that will depend on all header combinations, so this must be 
        the last of tasks.

        1. extract two equal sets combinations, and diff count possible combinations (if total - count > 0)
        2. make n equals sets combinations, and diff potential combination, don't test sets.
        3. make all combinations, test final set with constants and stuff (use notEqualSetCombinations transform function).

        All domains need to be extract from final accepted sets, but equals are garaneted to have a valid set even if constrained
        by constant or not equal sets, the only thing that changes is the number of counts, this assuming that we are always 
        using the original set with contrains, so even if we have big domain on equals the values will be cut because of orginal 
        sets contrains. 
 */

function seedSets(header, s) {
    const total = s.count();

    const equals = [];
    const potencialDiff = [];

    for (let i=0; i<header.length; i++) {
        const a = header[i];

        for (let j=i+1; j<header.length; j++) {
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

    /*
    const diff = [];
    while (potencialDiff.length) {
        const {
            domains: [a, b],
            count
        } = potencialDiff.pop();

        console.log("Test diff " + a + " <> " + b + ": " + count);

        diff.push(...selectNotEqualSet(s, [a, b]));
    }*/

    return {equals, notEquals: potencialDiff};
}

function nHeaderSets (header, twoHeaderSets, test) {
    const nSets = twoHeaderSets.slice();
    let step = nSets.slice();

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

function nSetsCombinations (header, s) {

    const {equals, notEquals} = seedSets(header, s);

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

    console.log("EQUAL SETS: " + JSON.stringify(equalSets));

    const notEqualSets = nHeaderSets(header, notEquals.map(v => v.domains), hs => 
        !s.select(hs, {
            name: "*<>*",
            predicate: (...args) => new Set(args).size === args.length
        }).isEmpty()
    );

    console.log("NOT EQUAL SETS: " + JSON.stringify(notEqualSets));
}

function *combinations (header, s) {
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
    let startTime = new Date().getTime();

    const domains = new Map();

    for (let i=0; i<header.length; i++) {
        const a = header[i];

        const domain = [...s.projection(a).values()];

        domains.set(a, domain);
    }

    eneStats.getDomains.time += (new Date().getTime()) - startTime;
    eneStats.getDomains.count++;

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

        let startTime = new Date().getTime();

        nSetsCombinations(header, s);

        for (let vs of combinations(header, s)) {
            eneStats.powerSet.time += (new Date().getTime()) - startTime;
            eneStats.powerSet.count++;
        
            const r = getSet(vs, domains);

            if (r && r.isSubset(s)) {
                const remain = s.difference(r);
                const ene = toENE(header, remain, max, i+1);
                
                if (ene && ene.solution) {
                    const rDomains = getDomains(r.header, r);
                    const {s, solution, count} = ene;

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
