"use strict";

const should = require("should");
const {Z} = require("../");
const {toValuesStrings} = require("../lib/utils");
const Table = require("../lib/manager/domains/table");
const utils = require("../lib/utils");

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

function explode (zvs, branchId, r, domains) {
	if (domains) {
		const results = [];
		const header = domains.header;
		for (let v of domains.values()) {
			const e = v instanceof Array?v:[v];
			results.push(replaceDomains(r, new Map(e.map((c, i) => [header[i], zvs.getObject(branchId, c)]))));
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
		return (zvs, branchId, r, domains) => {
			const rs = explode(zvs, branchId, r, domains);

			return rs.map(f);
		}
	}

	return ((zvs, b, r, domains) => [...toValuesStrings(zvs, b, r, domains, true)]);
}

function test (definitions, queries, options) {
	const dbname = "zebra.testing.database";

	should(definitions).be.type("string");
	should(queries).be.instanceof(Array);
	options = options || {};

	let db;

	return async function () {

		try {
			if (options.timeout) {
				this.timeout(options.timeout);
			}

			await Z.create(
				dbname,
				{
					settings: {
						depth: options.depth
					}
				}
			);

			db = await Z.connect(dbname);
			await db.execute(definitions);
			const QUERY = db.zvs.data.global("query");

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
								db.zvs,
								b,
								db.zvs.getObject(
									b,
									QUERY
								),
								db.zvs.branches.getDomains(b)
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

			await Z.remove(dbname);
		}
		catch (e) {
			await Z.remove(dbname);
			throw e;
		}
	}
}

module.exports = test;
