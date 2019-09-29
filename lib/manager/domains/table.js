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
    1. Make all combination of two variables,
    2. For each combination make 3 combinations (equal, not equal, **const)
    3. Get all domains for each result and if one is empty fail, if one is length 1 make it constant.
    4. With the rigth domains and constrains encoded check that set is subset of original set.
    5. Save sets that pass tests.
    6. ** For now just keep the rest of the current algorithm and decide from there **
 */
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
        for (let vs of powerSet(header, s)) {
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
