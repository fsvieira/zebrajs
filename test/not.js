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

	xit("Simple not",
		test(
			`(equal 'x 'x)
			 (blue)
			`, [{
				query: "?('x ^(equal 'x yellow))",
				results: ["@(blue)[^!(equal blue yellow)]"]
			}]
		)
	);

	xit("Simple not, no constants",
		test(
			"(equal 'x 'x) ('x)", [{
				query: "?('x ^(equal 'x yellow))",
				results: []
			}]
		)
	);

	xit("Not evaluation order",
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

	xit("Declare a not equal",
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

	xit("Should make distinct tuples",
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
						"@(distinct @(color @68=[yellow, blue, red]) @(color @73=[yellow, blue, red]))[^!(equal (color @68=[yellow, blue, red]) (color @73=[yellow, blue, red]))]"
					]
				}
			]
		)
	);

	xit("Should declare simple not.",
		test(
			`(number 0)
            (number 1)
            (not 'x 'y ^(equal 'x 'y))
            (equal 'x 'x)
            `, [{
				query: "?(not (number 'p) (number 'q))",
				results: [
					"@(not @(number @52=[0, 1]) @(number @57=[0, 1]))[^!(equal (number @52=[0, 1]) (number @57=[0, 1]))]"
				]
			}]
		)
	);

	xit("Should declare a list",
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
						"@(list @(fruit @81=[banana, strawberry, apple, papaya]) @(list @(fruit @86=[banana, strawberry, apple, papaya]) @(list)))[^!(equal @81=[banana, strawberry, apple, papaya] @86=[banana, strawberry, apple, papaya])]"
						// TODO: this have two repeated negations ? 
						// "@(list @(fruit @81=[banana, strawberry, apple, papaya]) @(list @(fruit @86=[banana, strawberry, apple, papaya]) @(list)))[^!(equal @81=[banana, strawberry, apple, papaya] @86=[banana, strawberry, apple, papaya]) !(equal @81=[banana, strawberry, apple, papaya] @86=[banana, strawberry, apple, papaya])]"
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
      				"[0]",
       				"[1, 0]",
      				"[1]"
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
						"[0, 1]",
						"[0, 2, 1]",
						"[0, 2]",
						"[0]",
						"[1, 0, 2]",
						"[1, 0]",
						"[1, 2, 0]",
						"[1, 2]",
						"[1]",
						"[2, 0, 1]",
						"[2, 0]",
						"[2, 1, 0]",
						"[2, 1]",
						"[2]"

						/*
						"[0, 1, 2]",
						"[0, 2, 1]",
						"[1, 0, 2]",
						"[1, 2, 0]",
						"[2, 0, 1]",
						"[2, 1, 0]",
						"[[v$99: 0 1 2]]",
						"[[v$99: 0 1], 2]",
						"[[v$99: 0 2], 1]",
						"[[v$99: 1 2], 0]"*/
					]
				}
			]
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
					"[0, 1, 2]",
					"[0, 1, 3, 2]",
					"[0, 1, 3]",
					"[0, 1]",
					"[0, 2, 1, 3]",
					"[0, 2, 1]",
					"[0, 2, 3, 1]",
					"[0, 2, 3]",
					"[0, 2]",
					"[0, 3, 1, 2]",
					"[0, 3, 1]",
					"[0, 3, 2, 1]",
					"[0, 3, 2]",
					"[0, 3]",
					"[0]",
					"[1, 0, 2, 3]",
					"[1, 0, 2]",
					"[1, 0, 3, 2]",
					"[1, 0, 3]",
					"[1, 0]",
					"[1, 2, 0, 3]",
					"[1, 2, 0]",
					"[1, 2, 3, 0]",
					"[1, 2, 3]",
					"[1, 2]",
					"[1, 3, 0, 2]",
					"[1, 3, 0]",
					"[1, 3, 2, 0]",
					"[1, 3, 2]",
					"[1, 3]",
					"[1]",
					"[2, 0, 1, 3]",
					"[2, 0, 1]",
					"[2, 0, 3, 1]",
					"[2, 0, 3]",
					"[2, 0]",
					"[2, 1, 0, 3]",
					"[2, 1, 0]",
					"[2, 1, 3, 0]",
					"[2, 1, 3]",
					"[2, 1]",
					"[2, 3, 0, 1]",
					"[2, 3, 0]",
					"[2, 3, 1, 0]",
					"[2, 3, 1]",
					"[2, 3]",
					"[2]",
					"[3, 0, 1, 2]",
					"[3, 0, 1]",
					"[3, 0, 2, 1]",
					"[3, 0, 2]",
					"[3, 0]",
					"[3, 1, 0, 2]",
					"[3, 1, 0]",
					"[3, 1, 2, 0]",
					"[3, 1, 2]",
					"[3, 1]",
					"[3, 2, 0, 1]",
					"[3, 2, 0]",
					"[3, 2, 1, 0]",
					"[3, 2, 1]",
					"[3, 2]",
					"[3]"
				]
			}], { timeout: 60000 * 5 }
		)
	);
});
