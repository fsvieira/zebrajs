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

        /*
        for (let c in this.table) {
            let cycle = c;
            let stack = [c];
            let id = c;
            do {
                if (c === this.table[c]) {
                    break;
                }

                id = this.table[c];
                c = id;

                if (stack.includes(id)) {
                    throw "Cycle id => " + cycle + " = " + id;
                }
            }
            while (id !== c);
        }*/
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

    set domains (domains) {
        this._domains = domains;
    }

    get domains () {
        return this._domains;
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

        this.r.domains = this.mergeDomains();
    }

    mergeDomains () {
        const dA = this.zvs.branches.getDomains(this.branchA);
        const dB = this.zvs.branches.getDomains(this.branchB);

        if (dA && dB) {
            const aHeader = dA.header;
            const bHeader = dB.header;
           
            let a = dA;
            let b = dB;
            const aBHeader = bHeader.filter(h => !aHeader.includes(h));
            const bAHeader = aHeader.filter(h => !bHeader.includes(h));

            if (aBHeader.length) {
                const aDiffSet = dB.projection(...aBHeader); 
                a = a.crossProduct(aDiffSet);
            }

            if (bAHeader.length) {
                const bDiffSet = dA.projection(...bAHeader); 
                b = b.crossProduct(bDiffSet);
            }

            const ab = a.intersect(b);

            return ab;
        }
        else {
            return dA || dB;
        }
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
        const aType = this.a.getType(aID);
        const bType = this.b.getType(bID);

        const fn = `${aType}X${bType}`;
        // console.log(fn);

        const id = this[fn](aID, bID);

        if (id) {
            this.r.transform(aID, id);
            this.r.transform(bID, id);
        }

        return id;
    }

    /*
     Unify methods 
    */

    /**
        Tuple
    */
    tupleXconstant () {}
    constantXtuple () {}
    domainXtuple () {}
    tupleXdomain () {}

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

            const negationA = (this.a.getData(aTuple.negation) || []).map(
                id => this.a.getObject(id)
            );

            const negationB = (this.b.getData(bTuple.negation) || []).map(
                id => this.b.getObject(id)
            );

            const negation = [...new Set(negationA.concat(negationB).map(n => this.zvs.data.add(n)))].map(
                id => this.r.getObject(id)
            );

            const tupleData = data.map(id => this.r.getObject(id));
            const id = this.zvs.data.add({
                type: "tuple",
                data: tupleData,
                check,
                negation
            });

            return id;
        }
    }

    /*
        variable ** X
    */
    variableXvariable (a, b) {
        a = this.a.rootID(a);
        b = this.b.rootID(b);

        this.r.transform(a, b);
        return b;
    }

    variableXconstant (a, b) {
        a = this.a.rootID(a);

        this.r.transform(a, b);
        return b;
    }

    variableXdomain (a, b) {
        a = this.a.rootID(a);
        b = this.b.rootID(b);

        this.r.transform(a, b);
        return b;
    }

    variableXtuple (a, b) {
        a = this.a.rootID(a);
        b = this.b.rootID(b);

        this.r.transform(a, b);
        return b;
    }

    /*
        X ** Variable 
    */
    constantXvariable (a, b) {
        a = this.a.rootID(a);
        b = this.b.rootID(b);

        this.r.transform(b, a);
        return a;
    }

    domainXvariable (a, b) {
        a = this.a.rootID(a);
        b = this.b.rootID(b);

        this.r.transform(b, a);
        return a;
    }

    tupleXvariable (a, b) {
        a = this.a.rootID(a);
        b = this.b.rootID(b);

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
        Domain
     */
    domainXdomain (a, b) {
        a = this.a.rootID(a);
        b = this.b.rootID(b);

        if (a !== b) {
            this.r.domains.s.s = this.r.domains.s.s
                .select(
                    [a, b], {
                        name: "=",
                        predicate: (a, b) => a === b
                    }
                );
        }

        return a;
    }

    domainXconstant (a, b) {
        a = this.a.rootID(a);
        b = this.b.rootID(b);

        this.r.domains.s.s = this.r.domains.s.s
            .select(
                [a], {
                    name: "const",
                    predicate: c => c === b
                }
            );

        return b;
    }

    /**
        Remove defers,
    */
    removeDefers (changes) {
        const getID = id => {
            let rID;

            do {
                rID = id;
                id = +(changes[id] || id);
            }
            while (rID !== id);

            return rID;
        }

        for (let id in changes) {
            id = +id;
            const rID = getID(id);
            changes[id] = rID;

            if (id === rID) {
                delete changes[id];
            }
        }
    }


    /*
        Get branches,
     */
    branches () {
        if (this.r.domains && this.r.domains.count() === 0) {
            return;
        }

        if (this.solveConflicts()) {
            const level = Math.max(
                this.zvs.branches.getLevel(this.branchA) + 1,
                this.zvs.branches.getLevel(this.branchB) + 1
            );
    
            // const branches = [];
            const rDomains = this.r.domains;

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

            // TODO: should't table be defers free ? 
            this.removeDefers(this.r.table);

            rawBranch.metadata.changes = this.r.table;

            rawBranch.domains = rDomains;

            return [branchId];
        }
    }
}

let counter = 0;
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
    
                const r = new MergedBranch(zvs, bA, bB);
                const bs = r.branches();

                if (bs && bs.length) {
                    nr = nr.concat(bs);
                }
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
    
    // console.log("-- Merge End --");

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
