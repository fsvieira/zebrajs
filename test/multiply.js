"use strict";

const test = require("../test-utils/test");

describe("Multiply Tests", () => {
	it("should multiply results.",
		test(
			`(yellow 'a)
            ('b blue)
            `, [{
				query: "?('c 'd)",
				results: [
					"@('c blue)",
					"@(yellow 'd)", 
					"@(yellow blue)"
				]
			}]
		)
	);

	it("should multiply results (with variables with same name).",
		test(
			`(yellow 'a)
            ('a blue)
            `, [{
				query: "?('a 'b)",
				results: [
					"@('a blue)",
					"@(yellow 'b)",
					"@(yellow blue)"
				]
			}]
		)
	);
});
