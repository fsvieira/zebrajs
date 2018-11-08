"use strict";

const test = require("../test-utils/test");
const ZTL = require("ztl");

describe("Factorial Parser Tests.", () => {
	const ztl = new ZTL();
	ztl.compile(`
		decimal:
			(nat 0) -> 0,
			(nat 'n) -> 1 + 'n | decimal.

		addResult:
			(+ ' ' 'r ') -> 'r | decimal.

		mulResult:
			(* ' ' 'r ') -> 'r | decimal.

		facResult:
			(fac ' 'r ') -> 'r | decimal.
	`);

	const decimal = r => ztl.fn.decimal(r);
	const add = r => ztl.fn.addResult(r);
	const mul = r => ztl.fn.mulResult(r);
	const fac = r => ztl.fn.facResult(r);

	it("Should declare ~Peanno numbers",
		test(
			`(nat 0)
			(nat (nat 'n))
			`, [{
					query: "?(nat (nat 1))",
					results: []
				},
				{
					query: "?(nat (nat 0))",
					results: ["@(nat @(nat 0))"]
				},
				{
					query: "?(nat 'n)",
					postProcessing: decimal,
					results: [
						0,
						1,
						2,
						3,
						4
					]
				}
			], { depth: 7 }
		)
	);

	it("Should declare a add func",
		test(
			`
            (nat 0)
            (nat (nat 'n))

            # a . 0 = a,
            (+ (nat 0) (nat 0) (nat 0) ')
            (+ (nat (nat 'a)) (nat 0) (nat (nat 'a)) ')
            (+ (nat 0) (nat (nat 'a)) (nat (nat 'a)) ')

            # a . S(b) = a + (a . b)
            (+ (nat (nat 'a)) (nat (nat 'b)) (nat 'r)
                (+ (nat (nat 'a)) (nat 'b) 'r ')
            )
			`, [
				//  0 + 0 = 0
				{
					query: "?(+ (nat 0) (nat 0) 'r ')",
					postProcessing: add,
					results: [0]
				},

				// 1 + 0 = 1
				{
					query: "?(+ (nat (nat 0)) (nat 0) 'r ')",
					postProcessing: add,
					results: [1]
				},

				// 0 + 1 = 1
				{
					query: "?(+ (nat 0) (nat (nat 0)) 'r ')",
					postProcessing: add,
					results: [1]
				},

				// 2 + 3 = 5
				{
					query:
						`?(+ (nat (nat (nat 0))) (nat (nat (nat (nat 0)))) 'r ')`,
					postProcessing: add,
					results: [5]
				},

				// 3 + 2 = 5
				{
					query:
						"?(+ (nat (nat (nat (nat 0)))) (nat (nat (nat 0))) " +
						"'r ')",
					postProcessing: add,
					results: [5]
				},

				// 2 + 2 = 4
				{
					query: "?(+ (nat (nat (nat 0))) (nat (nat (nat 0))) 'r ')",
					postProcessing: add,
					results: [4]
				}
			]
		)
	);

	it("Should declare a mul func",
		test(
			`
            # Nat
            (nat 0)
            (nat (nat 'n))

            # Add
            # a . 0 = a,
            (+ (nat 0) (nat 0) (nat 0) ')
            (+ (nat (nat 'a)) (nat 0) (nat (nat 'a)) ')
            (+ (nat 0) (nat (nat 'a)) (nat (nat 'a)) ')

            # a . S(b) = a + (a . b)
            (+ (nat (nat 'a)) (nat (nat 'b)) (nat 'r)
                (+ (nat (nat 'a)) (nat 'b) 'r ')
            )

            # List
            (list)
            (list 'item (list ' '))
            (list 'item (list))

            # Mul
            # a . 0 = 0
            (* (nat 0) (nat 0) (nat 0) ')
            (* (nat (nat 'a)) (nat 0) (nat 0) ')
            (* (nat 0) (nat (nat 'a)) (nat 0) ')

            # a . S(b) = a + (a . b)
            (* (nat (nat 'a)) (nat (nat 'b)) 'r
                (list (+ (nat (nat 'a)) 'rm 'r ')
                (list (* (nat (nat 'a)) (nat 'b) 'rm ') (list)))
            )
			`, [
				// 0 * 0 = 0
				{
					query: "?(* (nat 0) (nat 0) 'r ')",
					postProcessing: mul,
					results: [0]
				},

				// 1 * 0 = 0
				{
					query: "?(* (nat (nat 0)) (nat 0) 'r ')",
					postProcessing: mul,
					results: [0]
				},

				// 0 * 1 = 0
				{
					query: "?(* (nat 0) (nat (nat 0)) 'r ')",
					postProcessing: mul,
					results: [0]
				},

				// 1 * 1 = 1
				{
					query: "?(* (nat (nat 0)) (nat (nat 0)) 'r ')",
					postProcessing: mul,
					results: [1]
				},

				// 2 * 1 = 2
				{
					query: "?(* (nat (nat (nat 0))) (nat (nat 0)) 'r ')",
					postProcessing: mul,
					results: [2]
				},

				// 1 * 2 = 2
				{
					query: "?(* (nat (nat 0)) (nat (nat (nat 0))) 'r ')",
					postProcessing: mul,
					results: [2]
				},

				// 2 * 2 = 4
				{
					query: "?(* (nat (nat (nat 0))) (nat (nat (nat 0))) 'r ')",
					postProcessing: mul,
					results: [4]
				},

				// 2 * 3 = 6
				{
					query:
						"?(* (nat (nat (nat 0))) (nat (nat (nat (nat 0)))) " +
						"'r ')",
					postProcessing: mul,
					results: [6]
				},

				// 3 * 2 = 6
				{
					query:
						"?(* (nat (nat (nat (nat 0)))) (nat (nat (nat 0))) " +
						"'r ')",
					postProcessing: mul,
					results: [6]
				}
			], { timeout: 5000 }
		)
	);

	it("Should declare a factorial func",
		test(
			`
            # Nat
            # Nat
            (nat 0)
            (nat (nat 'n))

            # Add
            # a . 0 = a,
            (+ (nat 0) (nat 0) (nat 0) ')
            (+ (nat (nat 'a)) (nat 0) (nat (nat 'a)) ')
            (+ (nat 0) (nat (nat 'a)) (nat (nat 'a)) ')

            # a . S(b) = a + (a . b)
            (+ (nat (nat 'a)) (nat (nat 'b)) (nat 'r)
                (+ (nat (nat 'a)) (nat 'b) 'r ')
            )

            # List
            (list)
            (list 'item (list ' '))
            (list 'item (list))

            # Mul
            # a . 0 = 0
            (* (nat 0) (nat 0) (nat 0) ')
            (* (nat (nat 'a)) (nat 0) (nat 0) ')
            (* (nat 0) (nat (nat 'a)) (nat 0) ')

            # a . S(b) = a + (a . b)
            (* (nat (nat 'a)) (nat (nat 'b)) 'r
                (list (+ (nat (nat 'a)) 'rm 'r ')
                (list (* (nat (nat 'a)) (nat 'b) 'rm ') (list)))
            )

            # 0! = 1
            (fac (nat 0) (nat (nat 0)) ')
            (fac (nat (nat 'k)) (nat (nat 'n))
                (list (* 'n1 (nat (nat 'k)) (nat (nat 'n)) ')
                (list (fac (nat 'k) 'n1 ') (list)))
            )
			`, [
				// fac(0) = 1
				{
					query: "?(fac (nat 0) 'r ')",
					postProcessing: fac,
					results: [1]
				},

				// fac(1) = 1
				{
					query: "?(fac (nat (nat 0)) 'r ')",
					postProcessing: fac,
					results: [1]
				},

				// fac(2) = 2
				{
					query: "?(fac (nat (nat (nat 0))) 'r ')",
					postProcessing: fac,
					results: [2]
				},

				// fac(3) = 6
				{
					query: "?(fac (nat (nat (nat (nat 0)))) 'r ')",
					postProcessing: fac,
					results: [6]
				},

				// fac(4) = 24
				/*
				{
					query: "?(fac (nat (nat (nat (nat (nat 0))))) 'r ') "+
						"| facResult",
					results: [24]
				}*/
			], { timeout: 60000 * 5 }
		)
	);
});
