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
					`@(number @41=[0, 1, 2, 3])`
				]
			}]
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
			`, [{
				query: "?((number 'x) (number 'y))",
				results: [
					"@(@(number @58=[0, 1, 2, 3]) @(number @58=[0, 1, 2, 3]))",
					"@(@(number @58=[0, 1, 2, 3]) @(number @62=[0, 1, 2, 3]))"
				]
			}, {
				query: "?((number 'x) (number 'y) ^('x = 'y))",
				results: [
					"@(@(number @72=[0, 1, 2, 3]) @(number @76=[0, 1, 2, 3]))[^!(@72=[0, 1, 2, 3] = @76=[0, 1, 2, 3])]"
				]
			}]
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
					/*
						0 & 0 = 0
						1 & 1 = 1
					*/
					"@(@39=[0, 1] & @39=[0, 1] = @39=[0, 1])",

					/*
						0 & 1 = 0
						1 & 0 = 0
					 */
      				"@(@39=[0, 1] & @42=[0, 1] = 0)"
				]
			}]
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
					"@(list @(bit @69=[0, 1]) @(list @(bit @69=[0, 1]) @(list)))",
      				"@(list @(bit @69=[0, 1]) @(list @(bit @81=[0, 1]) @(list)))"
				]
			}]
		)
	);

	it("should create domains cartasian product result (unfold)",
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
					"@(unfold 2 @(bit @121=[0, 1]) @(unfold 1 @(bit @121=[0, 1]) @(unfold 0 @(bit 0) ')))",
					"@(unfold 2 @(bit @121=[0, 1]) @(unfold 1 @(bit @121=[0, 1]) @(unfold 0 @(bit 1) ')))",
					"@(unfold 2 @(bit @121=[0, 1]) @(unfold 1 @(bit @94=[0, 1]) @(unfold 0 @(bit 0) ')))",
					"@(unfold 2 @(bit @121=[0, 1]) @(unfold 1 @(bit @94=[0, 1]) @(unfold 0 @(bit 1) ')))"
				]
			}]
		)
	);
});

