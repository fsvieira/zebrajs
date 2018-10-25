"use strict";

const should = require("should");
const {Z} = require("../");
const {toStringDomain} = require("../lib/utils");
const FSA = require("fsalib");

const ZTL = require("ztl");

function normalize (s) {
	if (typeof s === "string") {
		return s
			.replace(/[\n\t ]+/g, " ")
			.trim()
		;
	}

	return s;
}

function words (fsa, variables, state, prefix) {
	prefix = prefix || [];

	if (variables.length) {
		state = state || fsa.start;
		
		const variable = variables.shift();
		const symbolTos = fsa.transitions.get(state);

		let results = [];
		for (let [symbol, to] of symbolTos) {
			results = results.concat(
				words(
					fsa,
					variables.slice(), 
					to.values().next().value, 
					prefix.concat({
						variable,
						symbol
					})
				)
			);
		}
		
		return results;
	}
	else {
		return [prefix];
	}
}

function replaceVariables (r, vs) {
	if (r.type === 'tuple') {
		return {
			...r,
			data: r.data.map(r => replaceVariables(r, vs))
		}
	}
	else if (r.type === 'domain') {
		return vs[r.id];
	}

	return r;
}

function getPostProcessingFunction (query) {

	let f = query.postProcessing;

	if (!f && query.ztl) {
		const ztl = new ZTL();
		ztl.compile(query.ztl.code);

		return (r, domains) => {
			if (domains.type === 'domains') {
				const fsa = FSA.fromJSON(domains.data);
				const rs = words(fsa, domains.data.variables).map(w => {
					const vs = {};

					for (let i=0; i<w.length; i++) {
						const o = w[i];
						vs[o.variable.id] = o.symbol;
					}

					return replaceVariables(r, vs);
				});

				return rs.map(r => ztl.fn[query.ztl.main](r));
			}
			else {
				return ztl.fn[query.ztl.main](r);
			}
		}
	}

	return f || ((r, domains) => toStringDomain(domains, r, true));
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

			await Z.create(
				dbname,
				{
					settings: {
						depth: options.depth
					}
				}
			);

			const db = await Z.connect(dbname);
			await db.execute(definitions);
			const DOMAINS = db.zvs.data.global("domains");
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
								db.zvs.getObject(
									b,
									QUERY
								),
								db.zvs.getObject(b, DOMAINS)
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