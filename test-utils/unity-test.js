"use strict";

const should = require("should");
const {Z} = require("../");
const {toString} = require("../lib/utils");
const Table = require("../lib/manager/domains/table");
const Session = require("../lib/manager/manager");


const ZTL = require("ztl");

function normalize (s) {
	if (typeof s !== "string") {
		s = JSON.stringify(s, null, '  ');
	}

	return s
		.replace(/[\n\t ]+/g, " ")
		.trim()
	;
}

function replaceDomains (r, valuesTable) {
	switch (r.type) {
		case "domain":
			return valuesTable.get(r.id);
		case "tuple":
			return {
				type: 'tuple',
				data: r.data.map(v => replaceDomains(v, valuesTable))
			};
		default:
			return r;
	}
}

function explode (r, domains) {
	if (domains && domains.length) {
		/**
		 * TODO: there is a bug on domains, there is some repeated domains.
		 */
		domains = [...new Map(domains.map(v => [v.id, v])).values()];

		const header = domains.map(v => v.id);
		const t = new Table(header);

		t.addENERow(domains.map(v => [v.id, v.data.map(v => v.data)]));
		
		const results = [];
		for (let e of t.s.values()) {
			// TODO: we need to use io objects with cset table.
			if (e instanceof Array) {
				results.push(replaceDomains(r, new Map(header.map((id, i) => [id, {type: "constant", data: e[i]}]))));
			}
			else {
				results.push(replaceDomains(r, new Map(header.map((id, i) => [id, {type: "constant", data: e}]))));
			}
		}

		return results;		
	}
	else {
		return [r];
	}
}

function getPostProcessingFunction (query) {

	let f = query.postProcessing;

	if (!f && query.ztl) {
		const ztl = new ZTL();
		ztl.compile(query.ztl.code);
		f = r => ztl.fn[query.ztl.main](r);
	}

	if (f) {
		return (r, domains) => {
			const rs = explode(r, domains.data);

			return rs.map(f);
		}
	}

	return (r => toString(r, true));
}

class SessionFilter extends Session {

	constructor (dbname, options, filter) {
		super(dbname, options);

		this.filter = filter;
		this.list = [];
	}

	async run () {
        if (!this.running) {
            this.running = true;

            while (this.running) {
				const {value: {action, data, destination}, done} = await this.queue.get();
				// console.log(action);
                const f = Session.actions[action];

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
}

function test (definitions, queries, options) {
	const dbname = "zebra.testing.database";

	should(definitions).be.type("string");
	should(queries).be.instanceof(Array);
	options = options || {};

	return async function () {
		try {
			if (options.timeout) {
				this.timeout(options.timeout);
			}

			const db = new SessionFilter(
				dbname, 
				{
					settings: {
						depth: options.depth
					}
				}
			);

			await db.execute(definitions);
			const QUERY = db.zvs.data.global("query");
			const DOMAINS_ID = db.zvs.data.global("domains");

			for (let q in queries) {
				if (queries.hasOwnProperty(q)) {
					const queryObject = queries[q];

					should(queryObject.results).be.instanceof(Array);
					queryObject.results = queryObject
						.results
						.map(normalize);

					queryObject.results.sort();

					queryObject.query = normalize(queryObject.query);
					queryObject.id = await db.execute(queryObject.query);
				}
			}

			for (let q in queries) {
				if (queries.hasOwnProperty(q)) {
					const qo = queries[q];
					const f = getPostProcessingFunction(qo);				
					const {query, results: qs, id} = qo;
					const results = await db.postOffice.pull(id);

					await db.postOffice.remove(id);

					let rs;

					/**
					 * TODO: 
					 * 	we need to normalize postOffice handling error, using a status object,
					 *  that should always come when pulling messages and maybe on listenners ? 
					 */

					if (results.length && results[0].status === 'error') {
						rs = results.map(r => r.data.message);
					}
					else {
						let r = [];
						for (let i=0; i<results.length; i++) {
							const b = results[i];
							const rs = f(
								db.zvs.getObject(
									b,
									QUERY
								),
								db.zvs.getObject(
									b,
									DOMAINS_ID
								)
							);

							if (rs instanceof Array) {
								r = r.concat(rs.map(normalize));
							}
							else {
								r.push(normalize(rs));
							}
						}

						r.sort();
					
						// remove duplicates,
						rs = [];
						for (let i=0; i<r.length; i++) {
							const s = r[i];

							if (!rs.includes(s)) {
								rs.push(s);
							}
						}
					}

					should(
						query + ": " + rs.join(";\n")
					).eql(
						query + ": " + qs.join(";\n")
					);
				}
			}
		}
		catch (e) {
			await Z.remove(dbname);
			throw e;
		}
	}
}

module.exports = test;
