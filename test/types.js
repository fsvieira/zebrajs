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
                        "@(x : int @(y : @146=[int, real] @(* : int -> @146=[int, real] -> @146=[int, real] ')))",
                        "@(x : real @(y : @146=[int, real] @(* : real -> @146=[int, real] -> real ')))"
                    ]
                },
                {
                    // x * y / int
                    query: `
                        ?(fn : 'r (x : 'tx (y : 'ty
                            (* : 'tx -> 'ty -> 'a (/ : 'a -> int -> 'r '))
                        )))
                    `,
                    /*
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
                    },*/
                    results: [
                        "fn: int -> int -> real",
                        "fn: int -> real -> real",
                        "fn: real -> int -> real",
                        "fn: real -> real -> real"

                        //    f(x, y) = x * y / int 

                        //    fn: int -> int -> int;
                        //    fn: int -> int -> real;
                        //    fn: int -> real -> real
                        
                    ]
                }
            ]
        )
    )
});
