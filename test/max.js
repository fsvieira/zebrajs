"use strict";

const test = require("../test-utils/test");

describe("Get the max solution.", () => {
	it("Declare a number set, get the max number set with all elements.",
		test(
			`(number 0)
            (number 1)
            (number 2)

            (equal 'x 'x)

            (set)
            (set (number 'a) (set) ')
            (set (number 'a) (set (number 'b) 'tail ') (set (number 'a) 'tail ')
                ^(equal (number 'a) (number 'b))
            )

            (max (set 'i 'tail 'p) ^(set ' (set 'i 'tail 'p) '))
            `, [{
                query: "?(max ')",
                ztl: {
                    code: `
                    number:
                        (number 'n) -> 'n.
    
                    set:
                        (set 'i (set) ') -> "" 'i | number,
                        (set 'i 'tail ') -> "" 'i | number ", " 'tail | set,
                        (set) -> "".
        
                    max:
                        (max 'set) -> "[" 'set | set "]\n".
                    `,
                    main: "max"
                },
				results: [
					"[0, 1, 2]",
					"[0, 2, 1]",
					"[1, 0, 2]",
					"[1, 2, 0]",
					"[2, 0, 1]",
					"[2, 1, 0]"
				]
			}], { timeout: 5 * 60 * 1000 }
		)
	);
});
