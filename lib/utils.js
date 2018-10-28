"use strict";

const FSA = require("fsalib");

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

			return `${v}_${s}`;
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
		/*
		case "domain":
			return "{{v$" + p.variable + " : " + toString(p.data, debug, false, variableNames) + "}}";
		*/

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
			let v = getVariableName(p, variableNames).replace("'", "").replace("$", "_");
			v = v===""?"_":v;
			return ".." + v;
		}

		case "variable":
			return getVariableName(p, variableNames);

		default:
			if (p.map) {
				return p.map(ts).sort().join("\n");
			}
	}
}

function printQuery (zvs, branchId, text) {
	console.log(
		(text ? text + " => " : "") +
		toStringDomain(
			zvs.getObject(branchId, zvs.data.global("domains")),
			zvs.getObject(branchId, zvs.data.global("query")), 
			true
		)
	);
}

module.exports = {
	toString,
	toStringDomain,
	printQuery
};
