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
                        `@(x : ..tx @(y : ..ty @(* : ..tx -> ..ty -> .._ '$1)))
                        --> digraph G {
                            rankdir=LR; size="8,5" node [shape = doublecircle]; "__5"; node [shape = circle];
                            START -> "tx_2" [label = "tx=int"]
                            START -> "tx_3" [label = "tx=real"]
                            "tx_2" -> "ty_6" [label = "ty=int"]
                            "tx_2" -> "ty_4" [label = "ty=real"]
                            "tx_3" -> "ty_4" [label = "ty=real"]
                            "tx_3" -> "ty_4" [label = "ty=int"]
                            "ty_4" -> "__5" [label = "_=real"]
                            "ty_6" -> "__5" [label = "_=int"] 
                        }`
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
            ]
        )
    )
});
