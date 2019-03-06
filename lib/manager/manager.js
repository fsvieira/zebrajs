"use strict";

const Queue = require("./queue");
const PostOffice = require("./postoffice");

const utils = require("../utils");
const ZVS = require("../zvs/zvs");

const { parse } = require("./transitions/parsing");

const {
	prepareDefinitions,
	checkDefinitions,
	multiplyDefinitions,
} = require("./transitions/definitions");

const {
	prepareQuery,
} = require("./transitions/query");

const {
	matchTuples,
	copyDefinitions,
	filterUncheckedTuples,
	check,
	domains
} = require("./transitions/tuples");

const {
	// filterUncheckedNegations,
	checkNegations
} = require("./transitions/negations");

const {
	merge
} = require("./transitions/merge");

const {
	success
} = require("./transitions/success");


const actions = {
    // Parsing,
	texts: parse,

    // definitions,
    prepareDefinitions: prepareDefinitions,
	checkDefinitions: checkDefinitions(false),
    multiplyDefinitions: multiplyDefinitions,
    checkMultiplyDefinitions: checkDefinitions(true),
    
	// Query,
	prepareQuery: prepareQuery,

    // Tuples,
    filterUncheckedTuples: filterUncheckedTuples,
    matchTuples: matchTuples,
    copyDefinitions: copyDefinitions,
    check: check,
    
    /*
	    - negations are checked after domain construction,
		  because even if we check them before, it will need 
		  to be re-checked after because individual tuples
		  may not contain all variable values necessary 
		  to eval a negation.
	*/
    domains: domains,
    
	// Negations,
    // filterUncheckedNegations: filterUncheckedNegations,
    // negations: negations,
    checkNegations,

    // Merge,
    merge: merge,
    success: success
};

class Session {

    constructor (username, {settings}) {
        this.running = false;
        this.queue = new Queue();
        this.postOffice = new PostOffice();
        this.username = username;
        this.zvs = new ZVS();

        this.store = {
            id: 0,
            definitions: []
        };

        this.zvs.update(
			this.zvs.branches.root,
			this.zvs.data.global("settings"), {
				data: settings
			}
		);

        this.run();
    }

    async run () {
        if (!this.running) {
            this.running = true;

            while (this.running) {
                const {value: {action, data, destination}, done} = await this.queue.get();
                const f = actions[action];

                if (f) {
                    // await f(action, data, destination, this);
                    setTimeout(async () => {
                        await f(action, data, destination, this);
                        done();
                    }, 0);
                }
                else {
                    throw `Action type '${action}' is not defined!!`;
                }
            }
        }
    }

    async execute (text, callback) {
        // send it to queue,
        const id = await this.postOffice.register(this.username, text);

        this.postOffice.addActives(id, 1);

        if (callback) {
            this.postOffice.listen(id, callback);
        }

        this.queue.put({action: 'texts', data: text, destination: id});

        return id;
    }

	// DB methods,
	async create ({id, description, definitions}) {
		if (id && definitions && description) {
			return await this.execute(definitions);
		}

        throw "Id, description or definitions are undefined!";
	}

    stop () {
        this.running = false;
    }

}

module.exports = Session;
