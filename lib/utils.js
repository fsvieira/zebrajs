"use strict";

// const FSA = require("fsalib");
const IdenticObjects = require("identicobjects");


function getVariableName (v, variableNames) {
	const vname = v.data || "";
	const vars = variableNames[vname] = variableNames[vname] || [];

	if (vars.indexOf(v.id) === -1) {
		vars.push(v.id);
	}

	const n = vars.indexOf(v.id);

	return "'" + vname + (n ? "$" + n : "");
}

function toStringDomain (domains, p, debug) {
	let g;
	let variableNames = {};

	if (domains && domains.type==='domains' && domains.data.variables.length) {
		const fsa = FSA.fromJSON(domains.data);
		const toStringState = s => {
			if (s === fsa.start) {
				return "START";
			}

			let v;
			for (let i=0; i<domains.data.variables.length; i++) {
				const states = fsa.positionStates(i+1);

				if (states.has(s)) {
					v = getVariableName(domains.data.variables[i], variableNames)
						.replace("'", "")
						.replace("$", "_")
					;

					if (v === "") {
						v = "_";
					}
					
					break;
				}
			}

			return `"${v}_${s}"`;
		};

		const toStringSymbol = (f, s, t) => {
			let v;
			for (let i=0; i<domains.data.variables.length; i++) {
				const states = fsa.positionStates(i+1);

				if (states.has(t)) {
					v = getVariableName(domains.data.variables[i], variableNames)
						.replace("'", "")
						.replace("$", "_")
					;
					
					if (v === "") {
						v = "_";
					}

					break;
				}
			}

			return `${v}=${toString(s, debug)}`;
		};

		g = fsa.toDot({
			toStringState,
			toStringSymbol
		});
	}

	/**
	 * TODO: insted of printing variable states, on variable, we should prefix 
	 * fsa states with var.
	 */

	return toString(p, debug, null, variableNames) + (g?" --> " + g:"");
}

function toString (p, debug, negations, variableNames) {

	variableNames = variableNames || {};

	const ts = v => toString(v, debug, negations, variableNames);

	if (!p) {
		return "";
	}

	switch (p.type) {
		case "tuple":
			return (!negations && debug && p.check ? "@" : "") +
				(negations && debug && p.exists === false ? "!" : "") +
				"(" + p.data.map(ts).join(" ") + ")" +
				(p.negation && p.negation.length ? "[^" +
					toString(p.negation, debug, true, variableNames) + "]" : ""
				);

		case "constant":
			return p.data;

		case "domain": {
			return `@${p.id}=[${p.data.map(c => c.data).join(", ")}]${
				debug?(p.merge?":" + JSON.stringify(p.merge):""):""
			}`;
		}

		case "variable":
			return getVariableName(p, variableNames);

		case "domains":
			return `@${p.id}=[${p.data.map(d => toString(d, debug, false, variableNames)).join("; ")}]`;

		default:
			if (p.map) {
				return p.map(ts).sort().join("\n");
			}
	}
}

function printQuery (zvs, branchId, text) {
	console.log(
		(text ? text + " => " : "") +
		toString(
			zvs.getObject(branchId, zvs.data.global("query")), 
			true
		)
	);
}

function printDomains (zvs, branchId, text) {
	console.log(
		(text ? text + " => " : "") +
		toString(
			zvs.getObject(branchId, zvs.data.global("domains")), 
			true
		)
	);
}

// --- Check Branch

function checkBranch (zvs, branchId, tag) {
	const tuples = [zvs.getObject(branchId, zvs.data.global("query"))];
	const oDomains = [];

	tag = tag || "CHECK BRANCH!!";

	while (tuples.length) {
		const t = tuples.pop();

		if (!t.data) {
			return;
		}

		for (let i=0; i<t.data.length; i++) {
			const v = t.data[i];

			if (v.type === 'tuple') {
				tuples.push(v);
			}
			else if (v.type === 'domain') {
				oDomains.push(v);
			}
		}
	}
	
	const domains = zvs.getObject(branchId, zvs.data.global("domains"));
	const dDomains = domains.data || [];

	const io = new IdenticObjects();

	const sdDomains = new Set(dDomains.map(o => io.get(o)));
	const soDomains = new Set(oDomains.map(o => io.get(o)));
	
	if (sdDomains.size !== dDomains.length) {
		console.log(tag);
		console.log("D=" + JSON.stringify(dDomains));
		throw "Inconsistent Branch, domains have repeated domains.";
	}

	for (let e of soDomains) {
		if (!sdDomains.has(e)) {
			console.log(tag);
			console.log("D=" + JSON.stringify(domains) + ", O=" + JSON.stringify(oDomains));
			console.log("Domains " + JSON.stringify(e) + " not found!");
			printQuery(zvs, branchId, tag + " Query");
			throw "Inconsistent Branch, domains on query body don't match to domains.";
		}
	}

	/*
		We can't do any of this checks:
			1. domains injection on negation queries makes them not equal size,

	if (sdDomains.size === soDomains.size) {
		for (let e of soDomains) {
			if (!sdDomains.has(e)) {
				console.log(tag);
				console.log("D=" + JSON.stringify(domains) + ", O=" + JSON.stringify(oDomains));
				console.log("Domains " + JSON.stringify(e) + " not found!");
				throw "Inconsistent Branch, domains on query body don't match to domains.";
			}
		}
	}
	else {
		console.log(tag);
		console.log(sdDomains.size + " === " + soDomains.size);
		console.log("D=" + JSON.stringify([...sdDomains]) + ", O=" + JSON.stringify([...soDomains]));
		printQuery(zvs, branchId, tag + " Query");
		throw "Inconsistent Branch, domains on query body don't match to domains.";
	}
	*/
}

function recorder (tag, or) {
	const obj = {};

	return {
		end: () => {
			console.log(JSON.stringify(obj));
		},
		proxy: _recorder(tag, or, obj)
	};
}

function _recorder (tag, or, obj={}) {
	const type = typeof or;

	if (or instanceof Array) {
		// console.log(`${tag} = ${or}`);
		obj[tag] = {return: or};
		return or;
	}
	else if (type === 'function') {
		return new Proxy(or, {
			apply: function(target, thisArg, argumentsList) {
				const v = target.apply(thisArg, argumentsList);
				// console.log(`${tag}(${argumentsList.join(", ")}) = ${v}`);

				const vo = {};
				obj[tag] = {
					call: {
						[JSON.stringify(argumentsList)]: {
							return: v,
							proxy: vo
						}
					}
				};

				return _recorder(tag, v, vo);
			}
		});
	}
	else if (type === 'object') {
		return new Proxy(or, {
			get: function(target, prop) {
				if (target.hasOwnProperty(prop)) {
					const p = target[prop];
					obj[tag] = obj[tag] || {};
					return _recorder(prop, p, obj[tag]);
				}

				return target[prop];
			}
		});
	}
	else {
		obj[tag] = {return: or};
		// console.log(tag, "=", or);
	}

	// don't proxy
	return or;
}

function branchArgs (zvs, branchId, branch) {
	const {
		parent,
		action,
		args
	} = branch.data;

	let a = [];
	if (
		["unify", "query", "unify&merge", "definitions"].includes(action)
	) {
		const parentID = parent instanceof Array?parent[0]:parent;

		for (let i=0; i<args.length; i++) {
			const id = args[i];

			a.push(
				toString(zvs.getObject(parentID, id), true)
			);
		}
	}
	else if (
		["_merge"].includes(action)
	) {
		for (let i=0; i<args.length; i++) {
			const id = args[i];

			a.push(
				toString(zvs.getObject(id, zvs.data.global("query")), true)
			);
		}
	}

	return JSON.stringify(a, null, '\t');
}

function toBranchString (zvs, branchId, branch) {
	return ""; // `${branchId} ${JSON.stringify(branch)}`;
}

module.exports = {
	toString,
	toBranchString,
	printDomains,
	printQuery,
	checkBranch,
	recorder,
	branchArgs
};
