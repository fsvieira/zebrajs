"use strict";

const test = require("../test-utils/test");

describe("Types Tests.", () => {
	it("should types",
		test(
            `
            (* : int -> int -> int ')
            (* : int -> real -> real ')
            (* : real -> int -> real ')
            (* : real -> real -> real ')

            (+ : int -> int -> int ')
            (+ : int -> real -> real ')
            (+ : real -> int -> real ')
            (+ : real -> real -> real ')

            (+ : string -> int ')
            (+ : string -> real ')
            (+ : int -> int ')
            (+ : real -> real ')

            (- : int -> int -> int ')
            (- : int -> real -> real ')
            (- : real -> int -> real ')
            (- : real -> real -> real ')

            (/ : int -> int -> real ')
            (/ : int -> real -> real ')
            (/ : real -> int -> real ')
            (/ : real -> real -> real ')

            ('x : 'y ')
            `,
            [
                {
                    query: `?(* : int -> 'x -> real ')`,
                    results: [
                        "@(* : int -> real -> real ')"
                    ]
                },
                {
                    query: `
                        ?(x : 'tx (y : 'ty
                            (* : 'tx -> 'ty -> ' ')
                        ))
                    `,
                    results: [
                        "@(x : @id$28=[int, real] @(y : @id$27=[real, int] @(* : @id$28=[int, real] -> @id$27=[real, int] -> real ')))",
                        // "@(x : @id$28=[int, real] @(y : @id$27=[int, real] @(* : @id$28=[int, real] -> @id$27=[int, real] -> real ')))",
                        "@(x : @id$28=[int, real] @(y : @id$28=[int, real] @(* : @id$28=[int, real] -> @id$28=[int, real] -> @id$28=[int, real] ')))"
                    ]
                },
                {
                    // x * y / int
                    query: `
                        ?(fn : 'r (x : 'tx (y : 'ty
                            (* : 'tx -> 'ty -> 'a (/ : 'a -> int -> 'r '))
                        )))
                    `,
                    ztl: {
                        code: `
                            nextTypes:
                                ('x : 'y 'r) -> " -> " 'y "" 'r | nextTypes,
                                ' -> "". 
                
                            firstType:
                                ('x : 'y 'r) -> "" 'y "" 'r | nextTypes,
                                ' -> "".
                
                            fn:
                                ('fn : 'fnt 'args) -> "" 'fn ": " 'args | firstType " -> " 'fnt,
                                ' -> "".        
                        `,
                        main: "fn"
                    },
                    results: [
                        "fn: int -> int -> real",
                        "fn: int -> real -> real",
                        "fn: real -> int -> real",
                        "fn: real -> real -> real"
                    ]
                }
            ],
            /*
            {
                report: "types"
            }*/
        )
    )
});
