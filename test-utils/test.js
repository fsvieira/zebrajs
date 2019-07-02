"use strict";

const should = require("should");
const {Z} = require("../");
const {toString} = require("../lib/utils");
const Table = require("../lib/manager/domains/table");
const path = require("path");
const fs = require("fs");
const utils = require("../lib/utils");
const reportsPath = path.join(process.cwd(), "reports");
const mkdirp = require("mkdirp");

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

function report (zvs, report) {
	if (report) {
		const dir = path.join(reportsPath, report); 
		mkdirp(path.join(reportsPath, report), err => {
			if (err) {
				console.log(err);
			}
			else {
				const branches = zvs.branches.branches;
				const branchesStreams = {};

				for (let branchId in branches) {
					branchId = +branchId;
					const branch = zvs.branches.getRawBranch(branchId);
					const {
						action,
						args
					} = branch.data;

					const s = branchesStreams[action] = branchesStreams[action] || fs.createWriteStream(
						path.join(dir, `${action}.txt`)
					);

					const rawArgs = JSON.stringify(args, null, '\t');
					const argsStr = utils.branchArgs(zvs, branchId, branch);
					const query = utils.toString(
						zvs.getObject(
							branchId,
							zvs.data.global("query")
						)
					) || "<no query>";

					s.write(
						`\n\n------- ${branchId} --------\n` +
						`action: ${action},\n` +
						`args: ${argsStr},\n` +
						`query: ${query},\n` +
						`rawArgs: ${rawArgs}`
					);
				}

				for (let action in branchesStreams) {
					branchesStreams[action].end("\n");
				}
			}
		});
	}
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

			await report(db.zvs, options.report);

			await Z.remove(dbname);
		}
		catch (e) {
			if (db) {
				await report(db.zvs, options.report);
			}

			await Z.remove(dbname);
			throw e;
		}
	}
}

module.exports = test;
