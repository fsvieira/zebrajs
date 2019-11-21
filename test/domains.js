"use strict";

const test = require("../test-utils/test");

describe("Test domain extraction.", () => {
	it("should be a easy domain",
		test(
            `
            (number 0)
            (number 1)
            (number 2)
            (number 3)
            `, [{
				query: `?(number 'a)`,
				results: [
					"@(number 0)",
					"@(number 1)",
					"@(number 2)",
					"@(number 3)"
				]
			}],
			{
				timeout: 1000 * 60 * 5
			}
		)
	);

	it("should make domain of two variables",
		test(
			`
			('x = 'x)
			(number 0)
			(number 1)
			(number 2)
			(number 3)
			((number 'x) (number 'y))
			`, 
			[{
				query: "?((number 'x) (number 'y))",
				results: [
					"@(@(number 0) @(number 0))",
					"@(@(number 0) @(number 1))",
					"@(@(number 0) @(number 2))",
					"@(@(number 0) @(number 3))",
					"@(@(number 1) @(number 0))",
					"@(@(number 1) @(number 1))",
					"@(@(number 1) @(number 2))",
					"@(@(number 1) @(number 3))",
					"@(@(number 2) @(number 0))",
					"@(@(number 2) @(number 1))",
					"@(@(number 2) @(number 2))",
					"@(@(number 2) @(number 3))",
					"@(@(number 3) @(number 0))",
					"@(@(number 3) @(number 1))",
					"@(@(number 3) @(number 2))",
					"@(@(number 3) @(number 3))"
				]
			}, /*{
				query: "?((number 'x) (number 'y) ^('x = 'y))",
				results: [
					"@(@(number 0) @(number 1))[^!(0 = 1) !(0 = 1)]",
					"@(@(number 0) @(number 2))[^!(0 = 2) !(0 = 2)]",
					"@(@(number 0) @(number 3))[^!(0 = 3) !(0 = 3)]", 
					"@(@(number 1) @(number 0))[^!(1 = 0) !(1 = 0)]",
					"@(@(number 1) @(number 2))[^!(1 = 2) !(1 = 2)]",
					"@(@(number 1) @(number 3))[^!(1 = 3) !(1 = 3)]",
					"@(@(number 2) @(number 0))[^!(2 = 0) !(2 = 0)]",
					"@(@(number 2) @(number 1))[^!(2 = 1) !(2 = 1)]",
					"@(@(number 2) @(number 3))[^!(2 = 3) !(2 = 3)]",
					"@(@(number 3) @(number 0))[^!(3 = 0) !(3 = 0)]",
					"@(@(number 3) @(number 1))[^!(3 = 1) !(3 = 1)]",
					"@(@(number 3) @(number 2))[^!(3 = 2) !(3 = 2)]"
				]
			}*/],
			{
				timeout: 1000 * 60 * 5
			}
		)
	);

	it("should make domain of three variables",
		test(
			`
			(0 & 0 = 0)
			(0 & 1 = 0)
			(1 & 0 = 0)
			(1 & 1 = 1)
			`, [{
				query: "?('a & 'b = 'c)",
				results: [
					"@(0 & 0 = 0)",
					"@(0 & 1 = 0)",
					"@(1 & 0 = 0)",
					"@(1 & 1 = 1)"
				]
			}],
			{
				timeout: 1000 * 60 * 5
			}
		)
	);

	it("should create domains cartasian product result",
		test(
			`
			(bit 0)
			(bit 1)
			(list)
            (list (bit 'x) (list ' '))
			(list (bit 'x) (list))
			`, [{
				query: "?(list 'x (list 'y (list)))",
				results: [
				  	"@(list @(bit 0) @(list @(bit 0) @(list)))",
					"@(list @(bit 0) @(list @(bit 1) @(list)))",
					"@(list @(bit 1) @(list @(bit 0) @(list)))",
					"@(list @(bit 1) @(list @(bit 1) @(list)))"
				]
			}],
			{
				timeout: 1000 * 60 * 5
			}
		)
	);

	it("should create domains cartesian product result (unfold)",
		test(
			`
			(bit 0)
			(bit 1)
			(unfold 0 (bit 'a) ')
			(unfold 1 (bit 'b) (unfold 0 ' '))
			(unfold 2 (bit 'c) (unfold 1 ' '))
			`, [{
				query: "?(unfold 2 ' ')",
				results: [
					// 0 0 0
					// 0 0 1
					// 0 1 0
					// 0 1 1
					// 1 0 0
					// 1 0 1
					// 1 1 0
					// 1 1 1
					"@(unfold 2 @(bit 0) @(unfold 1 @(bit 0) @(unfold 0 @(bit 0) ')))",
					"@(unfold 2 @(bit 0) @(unfold 1 @(bit 0) @(unfold 0 @(bit 1) ')))",
					"@(unfold 2 @(bit 0) @(unfold 1 @(bit 1) @(unfold 0 @(bit 0) ')))",
					"@(unfold 2 @(bit 0) @(unfold 1 @(bit 1) @(unfold 0 @(bit 1) ')))",
					"@(unfold 2 @(bit 1) @(unfold 1 @(bit 0) @(unfold 0 @(bit 0) ')))",
					"@(unfold 2 @(bit 1) @(unfold 1 @(bit 0) @(unfold 0 @(bit 1) ')))",
					"@(unfold 2 @(bit 1) @(unfold 1 @(bit 1) @(unfold 0 @(bit 0) ')))",
					"@(unfold 2 @(bit 1) @(unfold 1 @(bit 1) @(unfold 0 @(bit 1) ')))"
				]
			}],
			{
				timeout: 1000 * 60 * 5
			}
		)
	);
});

