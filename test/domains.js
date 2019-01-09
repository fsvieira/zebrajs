"use strict";

const test = require("../test-utils/test");

describe("Test domain extraction.", () => {
	xit("should be a easy domain",
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
			('x = 'y)
			(number 0)
			(number 1)
			(number 2)
			(number 3)
			((number 'x) (number 'y))
			`, [{
				query: `?((number 'x) (number 'y))`,
				results: [
					`@(@(number @60=[0, 1, 2, 3]) @(number @64=[0, 1, 2, 3]))`
				]
			}, {
				query: `?((number 'x) (number 'y) ^('x = 'y))`,
				results: [
					// WRONG: "@(@(number @60=[0, 1, 2, 3]) @(number @60=[0, 1, 2, 3]))",
					  "@(@(number @60=[0, 1, 2, 3]) @(number @64=[0, 1, 2, 3]))"
					  /*
					`
					@(@(number ..x) @(number ..y))
					--> digraph G {
						rankdir=LR; size="8,5" node [shape = doublecircle]; "y_3"; node [shape = circle]; 
						START -> "x_2" [label = "x=0"]
						START -> "x_2" [label = "x=1"]
						START -> "x_2" [label = "x=2"]
						START -> "x_2" [label = "x=3"]
						"x_2" -> "y_3" [label = "y=0"] 
						"x_2" -> "y_3" [label = "y=1"] 
						"x_2" -> "y_3" [label = "y=2"] 
						"x_2" -> "y_3" [label = "y=3"] 
					}`*/
				]
			}]
		)
	);

	xit("should make domain of three variables",
		test(
			`
			(0 & 0 = 0)
			(0 & 1 = 0)
			(1 & 0 = 0)
			(1 & 1 = 1)
			`, [{
				query: `?('a & 'b = 'c)`,
				results: [
					/*
						0 & 0 = 0
						0 & 1 = 0
					 */
					"@(0 & @42=[0, 1] = 0)",

					/*
						1 & 0 = 0
						1 & 1 = 1
					 */
					"@(1 & @42=[0, 1] = @42=[0, 1])"
				]
			}]
		)
	);
});

