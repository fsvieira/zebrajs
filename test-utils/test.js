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

function changesToString (zvs, changes, parentId, branchId) {
	let s = "";

	for (let pId in changes) {
		const bId = changes[pId];

		const r = utils.toString(
				zvs.getObject(parentId, bId),
				true
			) + " => " +
			utils.toString(
				zvs.getObject(branchId, pId),
				true
			)
		;

		const l = r.length >= 80?1:80 - r.length;

		s += r;
		for (let i=0; i<l;  i++) {
			s += " ";
		}

		s +=  `[${pId} -> ${bId}]\n`
	}

	return s;
}

function reportCheckDomains(zvs, branchId, reportString, sPath, error) {
	const DOMAINS_ID = zvs.data.global("domains");
	const domainsData = zvs.getData(branchId, DOMAINS_ID);

	if (domainsData.data) {
		const domainsIDs = zvs.getData(branchId, domainsData.data)
			.map(id => zvs.branches.getDataId(branchId, id));

		const QUERY_ID = zvs.data.global("query");
		const query = zvs.getData(branchId, QUERY_ID);
		const queryData = zvs.getData(branchId, query.data);
		const negations = zvs.getData(branchId, query.negations);

		const ids = [...queryData, ...(negations || [])].map(
			id => zvs.branches.getDataId(branchId, id)
		);
		
		const queryDomainIds = [];

		while (ids.length) {
			const id = ids.pop();

			const data = zvs.getData(branchId, id);
			const type = zvs.getData(branchId, data.type);

			if (type === 'domain') {
				if (!queryDomainIds.includes(id)) {
					queryDomainIds.push(id);
				}
			}
			else if (type === 'tuple') {
				const tupleData = zvs.getData(branchId, data.data);

				for (let i=0; i<tupleData.length; i++) {
					const tID = zvs.branches.getDataId(branchId, tupleData[i]);
					ids.push(tID);
				}
			}
		}

		const intersect = domainsIDs.filter(id => queryDomainIds.includes(id));

		if (intersect.length !== domainsIDs.length || intersect.length !== queryDomainIds.length) {
			error.write(
				"\n\n--- ERROR: Query Domains, mismatch query domains body ---\n" +
				JSON.stringify(domainsIDs) + "(D) & "+ 
				JSON.stringify(queryDomainIds) + "(Q) = " +
				JSON.stringify(intersect) + "(D&Q)\n\n"+  
				sPath + "\n" +
				reportString
			);
		}

	}
}

function report (zvs, report) {
	if (report) {
		const dir = path.join(reportsPath, report);

		mkdirp(path.join(reportsPath, report), err => {
			if (err) {
				console.log(err);
			}
			else {
				const error = fs.createWriteStream(path.join(dir, "__errors.txt"));
				const branches = zvs.branches.branches;
				const branchesStreams = {};

				for (let branchId in branches) {
					branchId = +branchId;
					const branch = zvs.branches.getRawBranch(branchId);
					const {
						data: {
							action,
							args,
							parent
						},
						metadata: {changes, status}
					} = branch;

					const parentId = parent instanceof Array?branchId:parent;
					const sPath = path.join(dir, `${action}.txt`);
					const s = branchesStreams[action] = branchesStreams[action] || fs.createWriteStream(sPath);

					const rawArgs = JSON.stringify(args, null, '\t');
					const argsStr = utils.branchArgs(zvs, branchId, branch);
					const query = utils.toString(
						zvs.getObject(
							branchId,
							zvs.data.global("query")
						), true
					) || "<no query>";


					const DOMAINS_ID = zvs.data.global("domains");
					const domainsData = zvs.getData(branchId, DOMAINS_ID);
					const domainsIDs = zvs.getData(branchId, domainsData.data)
					const jsonDomains = zvs.getObject(branchId, DOMAINS_ID);

					const reportString = `\n\n------- ${branchId} --------\n` +
						`parent: ${JSON.stringify(parentId)},\n` +
						`action: ${action},\n` +
						`args: ${argsStr},\n` +
						`query: ${query},\n` +
						`rawArgs: ${rawArgs}\n` +
						`domainsData: ${JSON.stringify(domainsData)}\n` +
						`domainsIDs: ${JSON.stringify(domainsIDs)}\n` +
						`rawDomains: ${JSON.stringify(jsonDomains, null, '\t')}\n` + 
						`domains: ${utils.toString(jsonDomains, null, '\t')}\n` +
						`status: ${JSON.stringify(status)}\n` +
						`\n-- changes --\n${changesToString(zvs, changes, parentId, branchId)}\n`
					;

					reportCheckDomains(zvs, branchId, reportString, sPath, error);

					if (domainsIDs && new Set(domainsIDs).size !== domainsIDs.length) {
						error.write(
							"\n\n--- ERROR: Duplicated Domains ---\n" +
							sPath + "\n" +
							reportString
						);
					}

					s.write(reportString);
				}

				for (let action in branchesStreams) {
					branchesStreams[action].end("\n");
				}

				error.end("\n");
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
		let stop = () => {};

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

			if (options.report && options.timedReport) {
				const id = setInterval(
					() => report(
						db.zvs, 
						path.join(
							options.report, 
							new Date().toISOString()
						)
					),
					options.timedReport
				);

				stop = () => clearInterval(id);
			}

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

			stop();
			await report(db.zvs, options.report);
			
			await Z.remove(dbname);
		}
		catch (e) {
			stop();
			if (db) {
				await report(db.zvs, options.report);
			}

			await Z.remove(dbname);
			throw e;
		}
	}
}

module.exports = test;
