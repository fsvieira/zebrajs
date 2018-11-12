"use strict";

const test = require("../test-utils/test");
const ZTL = require("ztl");

describe("Not Tests.", () => {

	const ztl = new ZTL();
	ztl.compile(`
		number:
			(number 'n) -> 'n.

		set:
			(set 'i (set) ') -> "" 'i | number,
			(set 'i 'tail ') -> "" 'i | number ", " 'tail | set,
			(set) -> "".

		setStart:
			(set 'i (set) ') -> "[" 'i | number "]\n",
			(set 'i 'tail ') -> "[" 'i | number ", " 'tail | set "]\n".
	`);

	const setStart = (r) => ztl.fn.setStart(r);

	it("Simple not",
		test(
			`(equal 'x 'x)
			 (blue)
			`, [{
				query: "?('x ^(equal 'x yellow))",
				results: ["@(blue)[^!(equal blue yellow)]"]
			}]
		)
	);

	it("Simple not, no constants",
		test(
			"(equal 'x 'x) ('x)", [{
				query: "?('x ^(equal 'x yellow))",
				results: []
			}]
		)
	);

	it("Not evaluation order",
		test(
			"(equal 'x 'x) ('x)", [{
				query: "?(equal ('x) (yellow) ^(equal ('x) (blue)))",
				results: [
					"@(equal @(yellow) @(yellow))" +
					"[^!(equal (yellow) (blue))]"
				]
			}]
		)
	);

	it("Declare a not equal",
		test(
			`(color 'a)
			 (equal 'x 'x)
			 (not-equal 'x 'y ^(equal 'x 'y))
			`, [{
					query: "?(equal yellow yellow)",
					results: [
						"@(equal yellow yellow)"
					]
				},
				{
					query: "?(equal yellow blue)",
					results: []
				},
				{
					query: "?(not-equal yellow yellow)",
					results: []
				},
				{
					query: "?(not-equal yellow blue)",
					results: [
						"@(not-equal yellow blue)[^!(equal yellow blue)]"
					]
				},
				{
					query: "?(not-equal (color yellow) (color yellow))",
					results: []
				},
				{
					query: "?(not-equal (color blue) (color yellow))",
					results: [
						"@(not-equal @(color blue) @(color yellow))" +
						"[^!(equal (color blue) (color yellow))]"
					]
				}
			]
		)
	);

	it("Should make distinct tuples",
		test(
			`(color yellow)
            (color blue)
            (color red)
            (equal 'x 'x)
            (distinct 'x 'y ^(equal 'x 'y))
			`, 
			[
				{
					query: "?(distinct (color yellow) (color yellow))",
					results: []
				},
				{
					query: "?(distinct (color yellow) (color blue))",
					results: [
						"@(distinct @(color yellow) @(color blue))" +
						"[^!(equal (color yellow) (color blue))]"
					]
				},
				{
					query: "?(distinct (color 'a) (color 'b))",
					results: [
						`@(distinct @(color ..a) @(color ..b))[^!(equal (color ..a) (color ..b))] 
							--> digraph G { rankdir=LR; size="8,5" node [shape = doublecircle]; a_5; node [shape = circle];
								START -> b_2 [label = "b=yellow"]
								START -> b_3 [label = "b=blue"]
								START -> b_4 [label = "b=red"]
								b_2 -> a_5 [label = "a=blue"]
								b_2 -> a_5 [label = "a=red"]
								b_3 -> a_5 [label = "a=yellow"]
								b_3 -> a_5 [label = "a=red"]
								b_4 -> a_5 [label = "a=yellow"]
								b_4 -> a_5 [label = "a=blue"] 
							}
						`
					]
				}
			]
		)
	);

	it("Should declare simple not.",
		test(
			`(number 0)
            (number 1)
            (not 'x 'y ^(equal 'x 'y))
            (equal 'x 'x)
            `, [{
				query: "?(not (number 'p) (number 'q))",
				results: [
					`@(not @(number ..p) @(number ..q))[^!(equal (number ..p) (number ..q))]
						--> digraph G {
							rankdir=LR; size="8,5" node [shape = doublecircle]; p_4; node [shape = circle]; 
								START -> q_2 [label = "q=0"]
								START -> q_3 [label = "q=1"]
								q_2 -> p_4 [label = "p=1"]
								q_3 -> p_4 [label = "p=0"] 
						}
					`
				]
			}]
		)
	);

	it("Should declare a list",
		test(
			`(list)
            (list 'item (list ' '))
            (list 'item (list))

            (fruit banana)
            (fruit strawberry)
            (fruit apple)
            (fruit papaya)

            (equal 'x 'x)`, [{
					query: "?(list)",
					results: [
						"@(list)"
					]
				},
				{
					query: "?(list (fruit banana) (list (fruit apple) (list)))",
					results: [
						"@(list @(fruit banana) @(list @(fruit apple) @(list)))"
					]
				},
				{
					query: "?(list (fruit 'a) (list (fruit 'b) (list)) " +
						" ^(equal 'a 'b))",
					results: [
						/*
						"@(list @(fruit apple) @(list @(fruit {{v$84 : banana papaya strawberry}}) @(list)))" +
							"[^!(equal apple {{v$84 : banana papaya strawberry}})]",
						"@(list @(fruit banana) @(list @(fruit {{v$84 : apple papaya strawberry}}) @(list)))" +
							"[^!(equal banana {{v$84 : apple papaya strawberry}})]",
						"@(list @(fruit papaya) @(list @(fruit {{v$84 : apple banana strawberry}}) @(list)))" +
							"[^!(equal papaya {{v$84 : apple banana strawberry}})]",
						"@(list @(fruit strawberry) @(list @(fruit {{v$84 : apple banana papaya}}) @(list)))" +
							"[^!(equal strawberry {{v$84 : apple banana papaya}})]"
						*/
						/**
						 * TODO: why this resutls don't have domains ? 
						 */
						"@(list @(fruit apple) @(list @(fruit banana) @(list)))[^!(equal apple banana)]",
						"@(list @(fruit apple) @(list @(fruit papaya) @(list)))[^!(equal apple papaya)]",
						"@(list @(fruit apple) @(list @(fruit strawberry) @(list)))[^!(equal apple strawberry)]",
						"@(list @(fruit banana) @(list @(fruit apple) @(list)))[^!(equal banana apple)]",
						"@(list @(fruit banana) @(list @(fruit papaya) @(list)))[^!(equal banana papaya)]",
						"@(list @(fruit banana) @(list @(fruit strawberry) @(list)))[^!(equal banana strawberry)]",
						"@(list @(fruit papaya) @(list @(fruit apple) @(list)))[^!(equal papaya apple)]",
						"@(list @(fruit papaya) @(list @(fruit banana) @(list)))[^!(equal papaya banana)]",
						"@(list @(fruit papaya) @(list @(fruit strawberry) @(list)))[^!(equal papaya strawberry)]",
						"@(list @(fruit strawberry) @(list @(fruit apple) @(list)))[^!(equal strawberry apple)]",
						"@(list @(fruit strawberry) @(list @(fruit banana) @(list)))[^!(equal strawberry banana)]",
						"@(list @(fruit strawberry) @(list @(fruit papaya) @(list)))[^!(equal strawberry papaya)]"
					]
				}
			]
		)
	);

	it("Should declare a two number Set",
		test(
			`(number 0)
            (number 1)
            (set)
            (set (number 'a) (set) ')
            (set (number 'a) (set (number 'b) 'tail ') (set (number 'a) 'tail ')
                ^(equal (number 'a) (number 'b))
            )

            (equal 'x 'x)
			`, [{
					query: `
    			        ?(set
        				    (number 'a)
        				    (set (number 'b) (set) ')
        				')
					`,
					postProcessing: setStart,
					results: [
						"[0, 1]",
						"[1, 0]"
					]
				},
				{
					query: `
    					?(set (number 'a)
    						(set (number 'b)
    						(set (number 'c) (set) ') ')
    					')
					`,
					postProcessing: setStart,
					results: []
				}
			]
		)
	);

	xit("Should declare a two number Set, query all",
		test(
			`(number 0)
            (number 1)
            (set)
            (set (number 'a) (set) ')
            (set (number 'a) (set (number 'b) 'tail ') (set (number 'a) 'tail ')
                ^(equal (number 'a) (number 'b))
            )

            (equal 'x 'x)
			`, [{
				query: "?(set (number 'a) 'tail ')",
				postProcessing: setStart,
				results: [
					"[0, 1]",
					"[1, 0]",
					"[[v$74: 0 1]]"
				]
			}]
		)
	);

	xit("Should declare a number Set, 3 elements",
		test(
			`(number 0)
            (number 1)
            (number 2)
            (set)
            (set (number 'a) (set) ')
            (set (number 'a) (set (number 'b) 'tail ') (set (number 'a) 'tail ')
                ^(equal (number 'a) (number 'b))
            )

            (equal 'x 'x)
            `, [{
					query: `?(set (number 0)
	                    (set (number 1)
	                    (set (number 2) (set) ') ')
					')`,
					postProcessing: setStart,
					results: ["[0, 1, 2]"]
				},
				{
					query: "?(set (number 'a) 'tail ')",
					postProcessing: setStart,
					results: [
						"[0, 1, 2]",
						"[0, 2, 1]",
						"[1, 0, 2]",
						"[1, 2, 0]",
						"[2, 0, 1]",
						"[2, 1, 0]",
						"[[v$99: 0 1 2]]",
						"[[v$99: 0 1], 2]",
						"[[v$99: 0 2], 1]",
						"[[v$99: 1 2], 0]"
					]
				}
			], { timeout: 60000 }
		)
	);

	xit("Should declare a number Set, 4 elements",
		test(
			`(number 0)
            (number 1)
            (number 2)
            (number 3)
            (set)
            (set (number 'a) (set) ')
            (set (number 'a)
                (set (number 'b) 'tail ')
                (set (number 'a) 'tail ')
                ^(equal (number 'a) (number 'b))
            )

            (equal 'x 'x)
			`, [{
					query: `?(set (number 0)
		                (set (number 1)
		                (set (number 2)
		                (set (number 3) (set) ') ') ')
					')`,
					postProcessing: setStart,
					results: ["[0, 1, 2, 3]"]
				},
				{
					query: `?(set (number 'a)
		                (set (number 'b)
		                (set (number 'c)
		                (set (number 'd) (set) ') ') ')
					')`,
					postProcessing: setStart,
					results: [
						"[0, 1, 2, 3]",
						"[0, 1, 3, 2]",
						"[0, 2, 1, 3]",
						"[0, 2, 3, 1]",
						"[0, 3, 1, 2]",
						"[0, 3, 2, 1]",
						"[1, 0, 2, 3]",
						"[1, 0, 3, 2]",
						"[1, 2, 0, 3]",
						"[1, 2, 3, 0]",
						"[1, 3, 0, 2]",
						"[1, 3, 2, 0]",
						"[2, 0, 1, 3]",
						"[2, 0, 3, 1]",
						"[2, 1, 0, 3]",
						"[2, 1, 3, 0]",
						"[2, 3, 0, 1]",
						"[2, 3, 1, 0]",
						"[3, 0, 1, 2]",
						"[3, 0, 2, 1]",
						"[3, 1, 0, 2]",
						"[3, 1, 2, 0]",
						"[3, 2, 0, 1]",
						"[3, 2, 1, 0]"
					]
				}
			], { timeout: 60000 * 10 }
		)
	);

	xit("Should declare a number Set, 4 elements, all",
		test(
			`(number 0)
            (number 1)
            (number 2)
            (number 3)
            (set)
            (set (number 'a) (set) ')
            (set (number 'a)
                (set (number 'b) 'tail ')
                (set (number 'a) 'tail ')
                ^(equal (number 'a) (number 'b))
            )

            (equal 'x 'x)
            `, [{
				query: "?(set (number 'a) 'tail ')",
				postProcessing: setStart,
				results: [
					"[0, 1, 2, 3]",
					"[0, 1, 3, 2]",
					"[0, 2, 1, 3]",
					"[0, 2, 3, 1]",
					"[0, 3, 1, 2]",
					"[0, 3, 2, 1]",
					"[1, 0, 2, 3]",
					"[1, 0, 3, 2]",
					"[1, 2, 0, 3]",
					"[1, 2, 3, 0]",
					"[1, 3, 0, 2]",
					"[1, 3, 2, 0]",
					"[2, 0, 1, 3]",
					"[2, 0, 3, 1]",
					"[2, 1, 0, 3]",
					"[2, 1, 3, 0]",
					"[2, 3, 0, 1]",
					"[2, 3, 1, 0]",
					"[3, 0, 1, 2]",
					"[3, 0, 2, 1]",
					"[3, 1, 0, 2]",
					"[3, 1, 2, 0]",
					"[3, 2, 0, 1]",
					"[3, 2, 1, 0]",
					"[[v$82: 0 1 2 3]]",
					"[[v$82: 0 1 2], 3]",
					"[[v$82: 0 1 3], 2]",
					"[[v$82: 0 1], 2, 3]",
					"[[v$82: 0 1], 3, 2]",
					"[[v$82: 0 2 3], 1]",
					"[[v$82: 0 2], 1, 3]",
					"[[v$82: 0 2], 3, 1]",
					"[[v$82: 0 3], 1, 2]",
					"[[v$82: 0 3], 2, 1]",
					"[[v$82: 1 2 3], 0]",
					"[[v$82: 1 2], 0, 3]",
					"[[v$82: 1 2], 3, 0]",
					"[[v$82: 1 3], 0, 2]",
					"[[v$82: 1 3], 2, 0]",
					"[[v$82: 2 3], 0, 1]",
					"[[v$82: 2 3], 1, 0]"
				]
			}], { timeout: 60000 * 5 }
		)
	);
});
