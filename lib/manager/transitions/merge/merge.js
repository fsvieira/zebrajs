"use strict";

// const actionUnify = require("../tuples/actionUnify");
const utils = require("../../../utils");
const Table = require("../../domains/table");
// const {CSetArray} = require("cset");


/*
    A B domains:
        - if A and B domains are not shared then DA * DB,
        - if A and B are shared, they must intersect,
*/

class ZMerge {
    constructor (zvs, branchA, branchB) {
        this.zvs = zvs;
        this.branchA = branchA;
        this.branchB = branchB;
        this.result = {};

        this.codesA = this.zvs.branches.table(branchA);
        this.codesB = this.zvs.branches.table(branchB);

        this.stack = [...new Set(Object.keys(this.codesA).concat(Object.keys(this.codesB)))];

        this.domains = {
            domainA: {},
            domainB: {},
            domainAB: {}
        };

        const DOMAINS_ID = zvs.data.global("domains");
        const domainsAId = zvs.branches.getDataId(branchA, DOMAINS_ID);
        const domainsBId = zvs.branches.getDataId(branchB, DOMAINS_ID);

        this.domains.domainsAId = domainsAId;
        this.domains.domainsBId = domainsBId;

        const domainsA = zvs.getData(branchA, domainsAId);
        const domainsDataA = (zvs.getData(branchA, domainsA.data) || [])
            .map(id => zvs.branches.getDataId(branchA, id));

        const domainsB = zvs.getData(branchB, domainsBId);
        const domainsDataB = (zvs.getData(branchA, domainsB.data) || [])
            .map(id => zvs.branches.getDataId(branchB, id));

        const domainsDataAB = new Set([...domainsDataA, ...domainsDataB]);

        for (let id of domainsDataAB) {
            if (
                domainsDataA.includes(id) && 
                domainsDataB.includes(id)
            ) {
                const domain = zvs.getData(branchA, id);
                const domainData = zvs.getData(branchA, domain.data);
                this.domains.domainAB[id] = {data: domainData, id: domain.id};

            }
            else if (domainsDataA.includes(id)) {
                const domain = zvs.getData(branchA, id);
                const domainData = zvs.getData(branchA, domain.data);
                this.domains.domainA[id] = {data: domainData, id: domain.id};
            }
            else {
                const domain = zvs.getData(branchB, id);
                const domainData = zvs.getData(branchB, domain.data);
                this.domains.domainB[id] = {data: domainData, id: domain.id};
            }
        }
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
        return this.domains.domainA[id] || this.domains.domainAB[id];
    }

    getDomainB (id) {
        return this.domains.domainB[id] || this.domains.domainAB[id];
    }


    merge (id, caId, cbId) {
        /*
        caId = this.zvs.branches.getDataId(this.branchA, caId);
        cbId = this.zvs.branches.getDataId(this.branchB, cbId);
        */

        if (caId === cbId) {
            return caId;
        }

        const typeA = this.getTypeA(caId);
        const typeB = this.getTypeB(cbId);

        const fn = `${typeA}X${typeB}`;
        // console.log(fn);
        return this[fn](id, caId, cbId);
    }

    /**
     * commit changes,
     */
    commit () {
        const level = Math.max(
            this.zvs.branches.getLevel(this.branchA) + 1,
            this.zvs.branches.getLevel(this.branchB) + 1
        );
    
        let branchId = this.zvs.branches.getId({
            parent: [this.branchA, this.branchB],
            args: [this.branchA, this.branchB],
            action: "merge",
            level: level
        }).branchId;
    
        let rawBranch = this.zvs.branches.getRawBranch(branchId);
    
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

        const table = new Table();
        table.addRowsABAB(
            this.domains.domainAB,
            this.domains.domainA,
            this.domains.domainB
        );

        
        /**
         * change domains,
         */
        /*
        const domainsIds = new Set();
        const domains = [];

        for (let id in this.domains.domainA) {
            const domain = this.domains.domainA[id];
            const d = {
                type: "domain",
                data: domain.data.map(id => this.zvs.getObject(this.branchA, id)),
                id: this.zvs.getData(this.branchA, domain.id)
            };

            const dID = this.zvs.data.add(d);

            this.result[id] = dID;

            if (!domainsIds.has(dID)) {
                domains.push(d);
                domainsIds.add(dID)
            }
        }

        for (let id in this.domains.domainB) {
            const domain = this.domains.domainB[id];
            const d = {
                type: "domain",
                data: domain.data.map(id => this.zvs.getObject(this.branchB, id)),
                id: this.zvs.getData(this.branchB, domain.id)
            };

            const dID = this.zvs.data.add(d);

            this.result[id] = dID;
            
            if (!domainsIds.has(dID)) {
                domains.push(d);
                domainsIds.add(dID)
            }
        }

        for (let id in this.domains.domainAB) {
            const domain = this.domains.domainAB[id];
            const d = {
                type: "domain",
                data: domain.data.map(id => this.zvs.getObject(this.zvs.branches.root, id)),
                id: this.zvs.getData(this.zvs.branches.root, domain.id)
            };

            const dID = this.zvs.data.add(d);

            this.result[id] = dID;
            
            if (!domainsIds.has(dID)) {
                domains.push(d);
                domainsIds.add(dID)
            }
        }


        const ds = this.zvs.data.add({
            type: "domains",
            data: domains,
            id: branchId
        });

        this.result[this.domains.domainsAId] = ds;
        this.result[this.domains.domainsBId] = ds;

        for (let id in this.result) {
            if (this.result[id] === id) {
                delete this.result[id];
            }
        }*/

        rawBranch.metadata.changes = this.result;

        return branchId;
    }


    /**
     * -- unify --
     */
    // -- Variables
    domainXvariable (id, caId, cbId) {
        if (id) {
            this.result[id] = caId;
        }
        
        this.result[caId] = caId;
        this.result[cbId] = caId;

        delete this.codesA[id];
        delete this.codesB[id];

        delete this.codesA[caId];
        delete this.codesB[cbId];

        return caId;
    }

    variableXdomain (id, caId, cbId) {
        if (id) {
            this.result[id] = cbId;
        }
        
        this.result[caId] = cbId;
        this.result[cbId] = cbId;

        delete this.codesA[id];
        delete this.codesB[id];

        delete this.codesA[caId];
        delete this.codesB[cbId];

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

        delete this.codesA[id];
        delete this.codesB[id];

        delete this.codesA[caId];
        delete this.codesB[cbId];

        return cbId;
    }

    variableXtuple (id, caId, cbId) {
        if (id) {
            this.result[id] = cbId;
        }

        this.result[caId] = cbId;
        this.result[cbId] = cbId;

        delete this.codesA[id];
        delete this.codesB[id];
        delete this.codesA[caId];
        delete this.codesB[cbId];

        return cbId;
    }

    variableXvariable (id, caId, cbId) {
        if (id) {
            this.result[id] = caId;
        }

        this.result[caId] = caId;
        this.result[cbId] = caId;

        delete this.codesA[id];
        delete this.codesB[id];
        delete this.codesA[caId];
        delete this.codesB[cbId];

        return caId;
    }

    // --- Tuple
    tupleXtuple (id, caId, cbId) {
        const dataA = this.zvs.getData(this.branchA, caId);
        const dataB = this.zvs.getData(this.branchB, cbId);

        const dataAData = this.zvs.getData(this.branchA, dataA.data);
        const dataBData = this.zvs.getData(this.branchB, dataB.data);

        // TODO: make new id ? 
        // this.result[id] = caId;
        if (dataAData.length === dataBData.length) {
            const data = [];            
            for (let i=0; i<dataAData.length; i++) {
                const a = this.zvs.branches.getDataId(this.branchA, dataAData[i]);
                const b = this.zvs.branches.getDataId(this.branchB, dataBData[i]);

                const m = this.merge(undefined, a, b);

                if (!m) {
                    return;
                }
                
                data.push(m);
            }

            const check = this.zvs.getData(this.branchA, dataA.check) 
                || this.zvs.getData(this.branchB, dataA.check);

            const tuple = {
                type: "tuple",
                data: data.map(id => this.zvs.getObject(this.zvs.branches.root, id)),
                check
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
        const domainA = this.getDomainA(caId);

        if (!domainA.data.includes(cbId)) {
            return;
        }
        
        if (id) {
            this.codesA[id] = cbId;
        }

        this.codesA[id] = cbId;

        for (let id in this.domains.domainA) {
            const ds = this.domains.domainA[id].data;

            const index = ds.indexOf(id);

            if (index !== -1) {
                // remove, 
                ds.splice(index, 1);

                if (ds.length === 0) {
                    return;
                }
                else if (ds.length === 1) {
                    console.log("TODO: make domain constant!!");
                }
            }
        }

        for (let id in this.domains.domainAB) {
            const ds = this.domains.domainAB[id].data;

            const index = ds.indexOf(id);

            if (index !== -1) {
                // remove, 
                ds.splice(index, 1);

                if (ds.length === 0) {
                    return;
                }
                else if (ds.length === 1) {
                    console.log("TODO: make domain constant!!");
                }
            }
        }

        return cbId;
    }

    domainXdomain (id, caId, cbId) {
        if (
            (this.domains.domainAB[caId] || this.domains.domainAB[cbId])
        ) {
            return;
        }

        const domainA = this.getDomainA(caId);
        const domainB = this.getDomainB(cbId);

        const r = {
            data: domainA.data.filter(c => domainB.data.includes(c)),
            id: domainA.id
        };

        if (r.data.length === 0) {
            console.log("Handle domain fail!!");
        }
        else if (r.data.length === 1) {
            console.log("Handle domain to constant");
        }
        else {
            delete this.domains.domainA[caId];
            delete this.domains.domainB[cbId];

            delete this.domains.domainA[id];
            delete this.domains.domainB[id];

            this.domains.domainAB[caId] = r;
            this.domains.domainAB[cbId] = r;

            if (id) {
                this.domains.domainAB[id] = r;
            }
        }

        return true;
    }

    domainsXdomains (id, caId, cbId) {
        /*
        console.log(id, caId, cbId);

        delete this.codesA[caId];
        delete this.codesB[cbId];*/

        return true;
    }
}

function mergeBranches (zvs, branchA, branchB) {
    const zm = new ZMerge(zvs, branchA, branchB);

    console.log("-- merge branches ---");
    utils.printQuery(zvs, branchA, "A");
    utils.printQuery(zvs, branchB, "B");

    while (zm.stack.length) {
        const id = zm.stack.pop();

        const caId = zm.getCodeA(id);
        const cbId = zm.getCodeB(id);

        if (caId && cbId) {
            if (cbId === caId) {
                zm.result[id] = cbId;
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
        }

//         delete zm.codesA[id];
//        delete zm.codesB[id];
    }
    
    const branchId = zm.commit();

    utils.printDomains(zvs, branchId, "D");
    utils.printQuery(zvs, branchId, "R");

    return [branchId];
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

module.exports = merge;
