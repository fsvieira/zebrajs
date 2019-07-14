"use strict";

const actionUnify = require("../tuples/actionUnify");
const utils = require("../../../utils");
const Table = require("../../domains/table");
const {CSetArray} = require("cset");

class ZMerge {
    constructor (zvs, branchA, branchB) {
        this.zvs = zvs;
        this.branchA = branchA;
        this.branchB = branchB;
        this.result = {};

        this.codesA = this.zvs.branches.table(branchA);
        this.codesB = this.zvs.branches.table(branchB);

        this.stack = [...new Set(Object.keys(this.codesA).concat(Object.keys(this.codesB)))];

        this.domainsA = {};
        this.domainsB = {};
        this.domainsAB = {};
    }

    getCodeA (id) {
        return this.codesA[id] || this.result[id];
    }

    getCodeB (id) {
        return this.codesB[id] || this.result[id];
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

    getDomainA (id) {
        let domain = this.domainsA[id] || this.domainsAB[id];

        if (!domain) {
            domain = this.zvs.getObject(this.branchA, id);
            domain = this.domainsA[id] = domain.data.map(d => d.data);
        }

        return domain;
    }

    getDomainB (id) {
        let domain = this.domainsA[id] || this.domainsAB[id];

        if (!domain) {
            domain = this.zvs.getObject(this.branchA, id);
            domain = this.domainsA[id] = domain.data.map(d => d.data);
        }

        return domain;
    }


    merge (id, caId, cbId) {
        const typeA = this.getTypeA(caId);
        const typeB = this.getTypeB(cbId);

        const fn = `${typeA}X${typeB}`;
        console.log(fn);
        return this[fn](id, caId, cbId);
    }

    /**
     * -- unify --
     */
    domainXvariable (id, caId, cbId) {
        if (id) {
            this.result[id] = caId;
            delete this.codesA[id];
            delete this.codesB[id];
        }
        else {
            this.result[caId] = caId;
            this.result[cbId] = caId;
        }
    }

    variableXconstant (id, caId, cbId) {
        if (id) {
            this.result[id] = cbId;
            delete this.codesA[id];
            delete this.codesB[id];
        }
        else {
            this.result[caId] = cbId;
            this.result[cbId] = cbId;
        }
    }

    tupleXtuple (id, caId, cbId) {
        const dataA = this.zvs.getData(this.branchA, caId);
        const dataB = this.zvs.getData(this.branchB, cbId);

        this.result[id] = caId;

        if (dataA.length === dataB.length) {
            for (let i=0; i<dataA.length; i++) {
                const a = zvs.getDataId(this.branchA, dataA[i]);
                const b = zvs.getDataId(this.branchB, dataB[i]);

                this.merge(undefined, a, b);
            }
        }

        return false;
    }

    domainXdomain (id, caId, cbId) {
        const domainA = this.getDomainA(caId);
        const domainB = this.getDomainB(cbId);

        const r = domainA.filter(c => domainB.includes(c));

        if (r.length === 1) {
            console.log("Handle domain to constant");
        }
        else {
            this.domainsA[caId] = r;
            this.domainsB[cbId] = r;
        }
    }

    domainsXdomains (id, caId, cbId) {
        console.log("TODO: domainsXdomains");
    }
}

function mergeBranches (zvs, branchA, branchB) {
    const zm = new ZMerge(zvs, branchA, branchB);

    while (zm.stack.length) {
        const id = zm.stack.pop();

        const caId = zm.getCodeA(id);
        const cbId = zm.getCodeB(id);

        if (caId && cbId) {
            if (cbId === caId) {
                zm.result[id] = cbId;
            }
            else {
                zm.merge(id, caId, cbId);
            }
        }
        else if (caId || cbId) {
            zm.result[id] = caId || cbId;
        }

        delete zm.codesA[id];
        delete zm.codesB[id];
    }

    const level = Math.max(
        zvs.branches.getLevel(branchA) + 1,
        zvs.branches.getLevel(branchB) + 1
    );

    let branchId = zvs.branches.getId({
        parent: [branchA, branchB],
        args: [branchA, branchB],
        action: "merge",
        level: level
    }).branchId;

    let rawBranch = zvs.branches.getRawBranch(branchId);

    console.log("Q => " + zvs.data.global("query"));

    rawBranch.metadata.changes = zm.result;

    utils.printQuery(zvs, branchId, "result");
    return [branchId];
}

    /*
        1. make a virtual merge class,
        2. create new virtualMerge with branchA and branchB,
            2a. construct dict of change codes for branchA,
            2b. construct dict of change codes for branchB
        3. check all ids and if they conflict solve conflict,
            3a. if id is not defined on a branch return undefined,
            3b. if one id is only defined in one branch, there is no clonfict,
            3c. if both branches ids return same code there is no conflict,
            3d. if both branches ids return diff solve conflict.
        4. implement recursive conflict solving, write changes on virtual dict:
            4a. we can add data to zvs, and only add changes on final branch commit.
            4b. or we can make a virtual manager?
    */

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

                const bs = mergeBranches(zvs, bA, bB);

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

/*
function *branchesCombinations (branches) {
    let s;
    for (let i=0; i<branches.length; i++) {
        const a = new CSetArray(branches[i]).as(`s_${i}`);
        s = s?s.crossProduct(a):a;
    }

    yield *s.values();
}

function merge (action, data, destination, session) {
	const zvs = session.zvs;
	const { branches } = data;

    for (let bs of branchesCombinations(branches)) {
        console.log(JSON.stringify(bs));
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
}*/

module.exports = merge;
