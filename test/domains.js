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
					`@(number ..a) 
					--> digraph G { 
						rankdir=LR; size="8,5" node [shape = doublecircle]; "a_2"; node [shape = circle]; 
						START -> "a_2" [label = "a=0"] 
						START -> "a_2" [label = "a=1"] 
						START -> "a_2" [label = "a=2"] 
						START -> "a_2" [label = "a=3"] 
					}`
				]
			}]
		)
	);

	it("should make domain of two variables",
		test(
			`
			(number 0)
			(number 1)
			(number 2)
			(number 3)
			((number 'x) (number 'y))
			`, [{
				query: `?((number 'x) (number 'y))`,
				results: [
					`@(@(number ..x) @(number ..y))
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
					}`
				]
			}]
		)
	);
});

