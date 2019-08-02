"use strict";

// const actionUnify = require("../tuples/actionUnify");
const utils = require("../../../utils");
const Table = require("../../domains/table");
const {CSetArray} = require("cset");


/*
    A B domains:
        - if A and B domains are not shared then DA * DB,
        - if A and B are shared, they must intersect,
*/

class Branch {
    constructor (zvs, branch, table, r) {
        this.zvs = zvs;
        this.table = table || this.zvs.branches.table(branch);
        this.branch = branch;
        this.r = r;
    }

    get ids () {
        return new CSetArray(Object.keys(this.table).map(id => +id));
    }

    transform (a, b) {
        this.table[a] = b;
    }

    rootID (id) {
        const rID = this.r?this.r.table[id] || id:id;

        return this.zvs.branches.getDataId(
            this.branch,
            rID
        );
    }

    getType (id) {
        const rID = this.rootID(id);
        const data = this.zvs.getData(this.branch, rID);
        return this.zvs.getData(this.branch, data.type);
    }

    getData (id) {
        const rID = this.rootID(id);

        return this.zvs.getData(this.branch, rID);
    }

    getObject (id) {
        return this.zvs.getObject(this.branch, id);
    }
}

class MergedBranch {
    constructor (zvs, branchA, branchB) {
        this.zvs = zvs;
        this.branchA = branchA;
        this.branchB = branchB; 

        this.r = new Branch(zvs, zvs.branches.root, {});

        this.a = new Branch(zvs, branchA, undefined, this.r);
        this.b = new Branch(zvs, branchB, undefined, this.r);
    }

    solveConflicts () {
        const aIDs = this.a.ids.as("a");
        const bIDs = this.b.ids.as("b");

        const ab = aIDs.intersect(bIDs);
        const da = aIDs.difference(ab);
        const db = bIDs.difference(ab);

        // Get values with no conflicts
        for (let id of da.values()) {
            this.r.transform(id, this.a.rootID(id));
        }

        for (let id of db.values()) {
            this.r.transform(id, this.b.rootID(id));
        }

        // Get conflicts
        this.conflicts = [];
        for (let id of ab.values()) {
            const aID = this.a.rootID(id);
            const bID = this.b.rootID(id);

            if (aID === bID) {
                this.r.transform(id, aID);
            }
            else {
                this.conflicts.push({
                    id,
                    aID,
                    bID
                });
            }
        }

        return this.mergeConflicts();
    }

    mergeConflicts () {
        while (this.conflicts.length) {
            const {id, aID, bID} = this.conflicts.pop();

            console.log(id, aID, bID);

            const rID = this.merge(aID, bID);

            if (rID) {
                this.r.transform(id, rID);
            }
            else if (rID === undefined) {
                // Fail everything
                return false;
            }
        }

        return true;
    }

    merge (aID, bID) {
        /*
        -- because of outdated ids, we can't trust on root ids from different branches.

        const raID = this.a.rootID(aID);
        const rbID = this.b.rootID(bID);

        console.log(
            "0: " + 
            utils.toString(this.zvs.getObject(this.zvs.branches.root, raID)) 
            + "  ** " + 
            utils.toString(this.zvs.getObject(this.zvs.branches.root, rbID))
        );

        if (raID === rbID) {
            this.r.transform(aID, raID);
            this.r.transform(bID, raID);

            console.log(
                "1: " + 
                utils.toString(this.zvs.getObject(this.branchA, aID)) 
                + "  ** " + 
                utils.toString(this.zvs.getObject(this.branchB, bID))
                + " = " + 
                utils.toString(this.zvs.getObject(this.zvs.branches.root, raID))
            );

            return raID;
        }*/

        const aType = this.a.getType(aID);
        const bType = this.b.getType(bID);

        const fn = `${aType}X${bType}`;

        console.log(
            "1: " + 
            utils.toString(this.zvs.getObject(this.branchA, aID)) 
            + "  ** " + 
            utils.toString(this.zvs.getObject(this.branchB, bID))
        );

        console.log(fn);
        const id = this[fn](aID, bID);

        this.r.transform(aID, id);
        this.r.transform(bID, id);

        console.log(
            "2: " + 
            utils.toString(this.zvs.getObject(this.branchA, aID)) 
            + "  ** " + 
            utils.toString(this.zvs.getObject(this.branchB, bID))
            + " = " + 
            utils.toString(this.zvs.getObject(this.zvs.branches.root, id))
        );

        return id;
    }

    /*
     Unify methods 
    */
    tupleXtuple (a, b) {
        const aTuple = this.a.getData(a);
        const bTuple = this.b.getData(b);

        const aData = this.a.getData(aTuple.data);
        const bData = this.b.getData(bTuple.data);

        if (aData.length === bData.length) {
            const data = [];
            for (let i=0; i<aData.length; i++) {
                const taID = aData[i];
                const tbID = bData[i];

                const id = this.merge(taID, tbID);
                if (id) {
                    data.push(id);
                }
                else {
                    return;
                }
            }

            const aCheck = this.a.getData(aTuple.check);
            const bCheck = this.b.getData(bTuple.check);
            const check = aCheck || bCheck;

            const tupleData = data.map(id => this.r.getObject(id));
            const id = this.zvs.data.add({
                type: "tuple",
                data: tupleData,
                check
            });

            return id;
        }
    }

    domainsXdomains () {
        /**
         * Ignore domains, they are alredy merged.
         */
        return null;
    }

    /*
        variable ** X
    */
    variableXconstant (a, b) {
        this.r.transform(a, b);
        return b;
    }

    /*
        X ** Variable 
    */
    constantXvariable (a, b) {
        this.r.transform(b, a);
        return a;
    }

    /*
        Constant
    */
    constantXconstant (a, b) {
        a = this.a.rootID(a);
        b = this.b.rootID(b);

        if (a === b) {
            return a;
        }        
    }

    /*
        Get branches,
     */
    branches () {
        if (this.solveConflicts()) {
            const level = Math.max(
                this.zvs.branches.getLevel(this.branchA) + 1,
                this.zvs.branches.getLevel(this.branchB) + 1
            );
    
            const branches = [];

            const branchId = this.zvs.branches.getId({
                parent: [this.branchA, this.branchB],
                args: [this.branchA, this.branchB, 0],
                action: "merge",
                level: level
            }).branchId;

            for (let id in this.result) {
                if (this.result[id] === +id) {
                    delete this.result[id];
                }
            }

            const rawBranch = this.zvs.branches.getRawBranch(branchId);

            rawBranch.metadata.changes = this.r.table;
            
            branches.push(branchId);

            return branches;
        }
    }
}

function mergeBranches (zvs, branchA, branchB) {
    const r = new MergedBranch(zvs, branchA, branchB);

    return r.branches();
}

class __ZMerge {
    constructor (zvs, branchA, branchB) {
        this.zvs = zvs;
        this.branchA = branchA;
        this.branchB = branchB;
        this.result = {};

        this.codesA = this.zvs.branches.table(branchA);
        this.codesB = this.zvs.branches.table(branchB);

        this.stack = [...new Set(Object.keys(this.codesA).concat(Object.keys(this.codesB)))];

        const DOMAINS_ID = zvs.data.global("domains");
        const domainsAId = zvs.branches.getDataId(branchA, DOMAINS_ID);
        const domainsBId = zvs.branches.getDataId(branchB, DOMAINS_ID);

        const domainsA = zvs.getData(branchA, domainsAId);
        const domainsDataA = (zvs.getData(branchA, domainsA.data) || [])
            .map(id => zvs.branches.getDataId(branchA, id));

        const domainsB = zvs.getData(branchB, domainsBId);
        const domainsDataB = (zvs.getData(branchA, domainsB.data) || [])
            .map(id => zvs.branches.getDataId(branchB, id));

        const header = [...new Set([...domainsDataA, ...domainsDataB])];

        let s;
        const ah = [];
        const bh = [];
        const abh = [];
        
        const domainIDs = {};

        for (let i=0; i<header.length; i++) {
            const h = header[i];

            let a, b, c;
            if (domainsDataA.includes(h)) {
                const aData = this.zvs.getData(this.branchA, h);
                const d = this.zvs.getData(this.branchA, aData.data);
                const id = this.zvs.getData(this.branchA, aData.id);

                a = new CSetArray(d);
                domainIDs[h] = id;
            }

            if (domainsDataB.includes(h)) {
                const bData = this.zvs.getData(this.branchB, h);
                const d = this.zvs.getData(this.branchB, bData.data);
                const id = this.zvs.getData(this.branchB, bData.id);

                b = new CSetArray(d);
                domainIDs[h] = id;
            }

            if (a && b) {
                c = a.intersect(b).as(h);
            }
            else {
                c = (a || b).as(h);
            }

            s = s?s.crossProduct(c):c;

            if (a && b) {
                for (let i=0; i<abh.length; i++) {
                    const xh = abh[i];

                    s = s.select([xh, h], {
                        name: "<>",
                        predicate: (a, b) => a !== b
                    });
                }

                ah.push(h);
                bh.push(h);
                abh.push(h);

            }
            else if (a) {
                for (let i=0; i<ah.length; i++) {
                    const xh = ah[i];

                    s = s.select([xh, h], {
                        name: "<>",
                        predicate: (a, b) => a !== b
                    });
                }

                ah.push(h);
                abh.push(h);

            }
            else if (b) {
                for (let i=0; i<bh.length; i++) {
                    const xh = bh[i];

                    s = s.select([xh, h], {
                        name: "<>",
                        predicate: (a, b) => a !== b
                    });
                }

                bh.push(h);
                abh.push(h);
            }
        }

        this.domains = {
            s: new Table(header, s),
            domainsAId,
            domainsBId,
            domainIDs
        };
    }

    getType(branchId, id) {
        const data = this.zvs.getData(branchId, id);
        return this.zvs.getData(branchId, data.type);
    }

    getTypeA (id) {
        return this.getType(this.branchA, id);
    }

    getTypeB (id) {
        return this.getType(this.branchB, id);
    }

    merge (id, caId, cbId) {
        caId = this.getIdA(caId);
        cbId = this.getIdB(cbId);

        if (caId === cbId) {
            return caId;
        }

        const typeA = this.getTypeA(caId);
        const typeB = this.getTypeB(cbId);

        const fn = `${typeA}X${typeB}`;
        console.log(fn);
        const r = this[fn](id, caId, cbId);

        this.removeDefers();

        return r;
    }

    getIdA (id) {
        return id!==undefined?+(this.codesA[id] || this.result[id] || id):undefined;
    }

    getIdB (id) {
        return id!==undefined?+(this.codesB[id] || this.result[id] || id):undefined;
    }

    getID (id, changes) {
        changes = changes || this.result;

        let tID;

        id = +id;
        do {
            tID = id;
            id = +(changes[id] || id);
        }
        while (id !== tID);

        return id;   
    }

    removeDefers (changes) {
        changes = changes || this.result;

        for (let id in this.result) {
            const rID = this.getID(id, changes)
            changes[id] = rID;

            delete this.codesA[id];
            delete this.codesB[id];

            delete this.codesA[rID];
            delete this.codesB[rID];

            if (id === rID) {
                delete changes[id];
            }
        }
    }
    
    /**
     * commit changes,
     */
    commit () {
        const level = Math.max(
            this.zvs.branches.getLevel(this.branchA) + 1,
            this.zvs.branches.getLevel(this.branchB) + 1
        );
        
        /**
         * Copy remain codes to result,
         */
        for (let id in this.codesA) {
            this.result[id] = this.codesA[id];
        }

        for (let id in this.codesB) {
            this.result[id] = this.codesB[id];            
        }

        /**
         * Make domains combinations,
         */
        const branches = [];

        if (this.domains.s.s) {
            const ene = this.domains.s.toENE().solution;

            for (let i=0; i<ene.length; i++) {
                const e = ene[i];
                const branchId = this.zvs.branches.getId({
                    parent: [this.branchA, this.branchB],
                    args: [this.branchA, this.branchB, i],
                    action: "merge",
                    level: level
                }).branchId;

                const domainsMap = new Map(e.domains);
                const domains = {
                    type: "domains",
                    data: [],
                    id: branchId
                };

                const changes = {...this.result};
            
                let rawBranch = this.zvs.branches.getRawBranch(branchId);
        
                for (let i=0; i<e.variables.length; i++) {
                    const vs = e.variables[i];
                    const id = vs[0];

                    const domainData = domainsMap.get(id);

                    let dID = domainData[0];
                    if (domainData.length > 1) {
                        const domain = {
                            type: "domain",
                            data: domainData.map(
                                id => this.zvs.getObject(this.zvs.branches.root, id)
                            ),
                            id: this.domains.domainIDs[id]
                        };

                        domains.data.push(domain);
                        dID = this.zvs.data.add(domain);
                    }

                    for (let i=0; i<vs.length; i++) {
                        const v = vs[i];
                        changes[v] = dID;
                    }
                }

                const domainID = this.zvs.data.add(domains);

                changes[this.domains.domainsAId] = domainID;
                changes[this.domains.domainsBId] = domainID;

                this.removeDefers(changes);

                for (let id in changes) {
                    if (changes[id] === +id) {
                        delete changes[id];
                    }
                }

                rawBranch.metadata.changes = changes;

                branches.push(branchId);

            }
        }
        else {
            const branchId = this.zvs.branches.getId({
                parent: [this.branchA, this.branchB],
                args: [this.branchA, this.branchB, 0],
                action: "merge",
                level: level
            }).branchId;

            for (let id in this.result) {
                if (this.result[id] === +id) {
                    delete this.result[id];
                }
            }

            const rawBranch = this.zvs.branches.getRawBranch(branchId);

            rawBranch.metadata.changes = this.result;
            
            branches.push(branchId);
        }

        return branches;
    }


    /**
     * -- unify --
     */

    // -- Variables
    tupleXvariable (id, caId, cbId) {
        if (id) {
            this.result[id] = caId;
        }
        
        this.result[caId] = caId;
        this.result[cbId] = caId;

        return caId;
    }

    domainXvariable (id, caId, cbId) {
        if (id) {
            this.result[id] = caId;
        }
        
        this.result[caId] = caId;
        this.result[cbId] = caId;

        return caId;
    }

    variableXdomain (id, caId, cbId) {
        if (id) {
            this.result[id] = cbId;
        }
        
        this.result[caId] = cbId;
        this.result[cbId] = cbId;

        return cbId;
    }
    
    variableXconstant (id, caId, cbId) {
        if (id) {
            this.result[id] = cbId;
            delete this.codesA[id];
            delete this.codesB[id];
        }
        
        this.result[caId] = cbId;
        this.result[cbId] = cbId;

        return cbId;
    }

    constantXvariable (id, caId, cbId) {
        if (id) {
            this.result[id] = caId;
            delete this.codesA[id];
            delete this.codesB[id];
        }
        
        this.result[caId] = caId;
        this.result[cbId] = caId;

        return caId;
    }

    variableXtuple (id, caId, cbId) {
        if (id) {
            this.result[id] = cbId;
        }

        this.result[caId] = cbId;
        this.result[cbId] = cbId;

        return cbId;
    }

    variableXvariable (id, caId, cbId) {
        if (id) {
            this.result[id] = caId;
        }

        this.result[caId] = caId;
        this.result[cbId] = caId;

        return caId;
    }

    // --- Tuple
    tupleXconstant () {}
    constantXtuple () {}

    tupleXtuple (id, caId, cbId) {
        const dataA = this.zvs.getData(this.branchA, caId);
        const dataB = this.zvs.getData(this.branchB, cbId);

        const dataAData = this.zvs.getData(this.branchA, this.getIdA(dataA.data));
        const dataBData = this.zvs.getData(this.branchB, this.getIdB(dataB.data));

        if (dataAData.length === dataBData.length) {
            const data = [];            
            for (let i=0; i<dataAData.length; i++) {
                const a = dataAData[i];
                const b = dataBData[i];
                
                const m = this.merge(undefined, a, b);

                if (!m) {
                    return;
                }
                
                data.push(m);
            }

            const check = this.zvs.getData(this.branchA, this.getIdA(dataA.check)) 
                || this.zvs.getData(this.branchB, this.getIdB(dataB.check));

            const negationA = (this.zvs.getData(this.branchA, this.getIdA(dataA.negation)) || []).map(
                id => this.zvs.getObject(this.branchA, this.getIdA(id))
            );

            const negationB = (this.zvs.getData(this.branchB, this.getIdB(dataB.negation)) || []).map(
                id => this.zvs.getObject(this.branchB, this.getIdB(id))
            );

            const negation = [...new Set(negationA.concat(negationB).map(n => this.zvs.data.add(n)))].map(
                id => this.zvs.getObject(this.zvs.branches.root, id)
            );

            const tuple = {
                type: "tuple",
                data: data.map(id => this.zvs.getObject(this.zvs.branches.root, id)),
                check,
                negation
            };

            const tId = this.zvs.data.add(tuple);

            if (id) {
                this.result[id] = tId;
            }
    
            this.result[caId] = tId;
            this.result[cbId] = tId;

            return tId;
        }

        return;
    }

    // --- domain
    domainXconstant (id, caId, cbId) {
        const dID = this.getIdA(caId);

        this.domains.s.s = this.domains.s.s
            .select(
                [dID], {
                    name: "const",
                    predicate: c => c === cbId
                }
            );
        
        return cbId;
    }

    constantXdomain (id, caId, cbId) {
        const dID = this.getIdB(cbId);

        this.domains.s.s = this.domains.s.s
            .select(
                [dID], {
                    name: "const",
                    predicate: c => c === caId
                }
            );
        
        return caId;
    }

    domainXdomain (id, caId, cbId) {
        const daID = this.getIdA(caId);
        const dbID = this.getIdB(cbId);

        this.domains.s.s = this.domains.s.s
            .select(
                [daID, dbID], {
                    name: "=",
                    predicate: (a, b) => a === b
                }
            );
        
        return caId;
    }

    domainsXdomains (id, caId, cbId) {
        return caId;
    }

    // -- 
    // if merge called this function than constants are not equal
    constantXconstant () {}
}

function __mergeBranches (zvs, branchA, branchB) {
    const zm = new ZMerge(zvs, branchA, branchB);

    while (zm.stack.length) {
        const id = zm.stack.pop();

        console.log(
            utils.toString(zvs.getObject(branchA, id))
            + " ** " +
            utils.toString(zvs.getObject(branchB, id))
        );

        if (!zm.merge(id, id, id)) {
            // fail!!
            return;
        }


        // TODO:
        // 1. use getIdA/getIdB and always merge,
        // 2. just merge (getIdA and getIdB are called inside)
        // 3. check for domain ids.

        /*
        const caId = zm.getCodeA(id);
        const cbId = zm.getCodeB(id);

        console.log(
            utils.toString(zvs.getObject(branchA, caId))
            + " ++ " +
            utils.toString(zvs.getObject(branchB, cbId))
        );

        if (caId && cbId) {
            if (cbId === caId) {
                zm.result[id] = cbId;

                delete zm.codesA[caId];
                delete zm.codesB[cbId];
    
                delete zm.codesA[id];
                delete zm.codesB[id];
    
            }
            else {
                if (!zm.merge(id, caId, cbId)) {
                    // fail!!
                    return;
                }
            }
        }
        else if (caId || cbId) {
            zm.result[id] = caId || cbId;
            delete zm.codesA[caId];
            delete zm.codesB[cbId];

            delete zm.codesA[id];
            delete zm.codesB[id];
        }*/
    }
    
    return zm.commit();
}

function merge (action, data, destination, session) {
	const zvs = session.zvs;
	const { branches } = data;

	/**
	 * order branches groups by size,
	 */
	while (branches.length > 1) {
        branches.sort((a, b) => b.length - a.length);

		const a = branches.pop();
		const b = branches.pop();

		let nr = [];

		for (let i = 0; i < a.length; i++) {
			const bA = a[i];

			for (let j = 0; j < b.length; j++) {
				let bB = b[j];

                console.log("\n-- Start --");
                utils.printQuery(zvs, bA, "BA");
                utils.printQuery(zvs, bB, "BB");

                const bs = mergeBranches(zvs, bA, bB);

                if (bs && bs.length) {
                    bs.forEach(b => {
                        utils.printQuery(zvs, b, "R")
                    });

                    nr = nr.concat(bs);
                }

                console.log("-- End --\n");
            }
		}

		if (nr.length === 0) {
			// everything fails,
			//  fail,
			//  TODO: we need to fail father branch,
			//  zvs.branches.notes(
			//	branchId,
			//	{status: {fail: true, reason: "merge fail!"}});

			session.postOffice.subActives(destination, 1);

			return;
		}

		branches.push(nr);
	}

	session.postOffice.addActives(destination, 1);
	session.queue.put({
		action: "checkNegations",
		data: {
			branches
		},
		destination
	});

    session.postOffice.subActives(destination, 1);
}

module.exports = merge;
