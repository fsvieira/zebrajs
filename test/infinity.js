"use strict";

const test = require("../test-utils/test");

describe("Inifinity tests.", () => {
	it("Should declare natural numbers and query all natural numbers",
		test(
			"(nat 0) (nat (nat 'x))", [{
				query: "?(nat 'x)",
				results: [
					"@(nat 0)",
					"@(nat @(nat 0))",
					"@(nat @(nat @(nat 0)))"
				]
			}], { depth: 5 }
		)
	);

	it("Should declare recursive tuples",
		/*
		    A = B
		    B = A
		*/
		test(
			"(a (b 'a)) (b (a 'b)) ('x stop)", [{
				query: "?(a 'b)",
				results: [
					"@(a @(b @(a @(b @(a stop)))))",
					"@(a @(b @(a @(b stop))))",
					"@(a @(b @(a stop)))",
					"@(a @(b stop))",
					"@(a stop)"
				]
			}], { depth: 7 }
		)
	);

});
