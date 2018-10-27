"use strict";

const test = require("../test-utils/test");

describe("Brave puzzle Tests.", () => {
	xit("should solve brave puzzle",
		test(
			`(letter B)
            (letter R)
            (letter A)
            (letter V)
            (letter E)

            (equal 'x 'x)

            (distinct
                (letter 'b) (letter 'r) (letter 'a) (letter 'v) (letter 'e)
                ^(equal 'b 'r) ^(equal 'b 'a) ^(equal 'b 'v) ^(equal 'b 'v)
                ^(equal 'b 'e) ^(equal 'r 'a) ^(equal 'r 'v) ^(equal 'r 'v)
                ^(equal 'r 'e) ^(equal 'a 'v) ^(equal 'a 'e)
            )

            (conditions '1 '2 '3 '4 '5 '6 '7 '8 '9 '10 '11 '12)

            (brave
                'x1y1 'x2y1 'x3y1 'x4y1 'x5y1
                'x1y2 'x2y2 'x3y2 'x4y2 'x5y2
                'x1y3 'x2y3 'x3y3 'x4y3 'x5y3
                'x1y4 'x2y4 'x3y4 'x4y4 'x5y4
                'x1y5 'x2y5 'x3y5 'x4y5 'x5y5
                (
                    conditions
                    (distinct 'x1y1 'x2y1 'x3y1 'x4y1 'x5y1)
                    (distinct 'x1y2 'x2y2 'x3y2 'x4y2 'x5y2)
                    (distinct 'x1y3 'x2y3 'x3y3 'x4y3 'x5y3)
                    (distinct 'x1y4 'x2y4 'x3y4 'x4y4 'x5y4)
                    (distinct 'x1y5 'x2y5 'x3y5 'x4y5 'x5y5)

                    (distinct 'x1y1 'x1y2 'x1y3 'x1y4 'x1y5)
                    (distinct 'x2y1 'x2y2 'x2y3 'x2y4 'x2y5)
                    (distinct 'x3y1 'x3y2 'x3y3 'x3y4 'x3y5)
                    (distinct 'x4y1 'x4y2 'x4y3 'x4y4 'x4y5)
                    (distinct 'x5y1 'x5y2 'x5y3 'x5y4 'x5y5)

                    (distinct 'x1y1 'x2y2 'x3y3 'x4y4 'x5y5)
                    (distinct 'x1y5 'x2y4 'x3y3 'x4y2 'x5y1)
                )
            )
            `, [{
                    query: `?(brave
                            (letter B) (letter R) (letter A) (letter V) (letter E)
                            '          (letter E) (letter B) (letter R) '
                            '          '          (letter V) '          (letter B)
                            '          (letter B) (letter R) '          '
                            '          '          (letter E) (letter B) '
                            '
                            )
                    `,
                    ztl: {
                        code: `
                            letter:
                                (letter 'l) -> 'l.
            
                            brave:
                                (brave
                                'x1y1 'x2y1 'x3y1 'x4y1 'x5y1
                                'x1y2 'x2y2 'x3y2 'x4y2 'x5y2
                                'x1y3 'x2y3 'x3y3 'x4y3 'x5y3
                                'x1y4 'x2y4 'x3y4 'x4y4 'x5y4
                                'x1y5 'x2y5 'x3y5 'x4y5 'x5y5
                                '
                                ) -> ""
                                    'x1y1 | letter " " 'x2y1 | letter " " 'x3y1 | letter
                                        " " 'x4y1 | letter " " 'x5y1 | letter "\n"
                                    'x1y2 | letter " " 'x2y2 | letter " " 'x3y2 | letter
                                        " " 'x4y2 | letter " " 'x5y2 | letter "\n"
                                    'x1y3 | letter " " 'x2y3 | letter " " 'x3y3 | letter
                                        " " 'x4y3 | letter " " 'x5y3 | letter "\n"
                                    'x1y4 | letter " " 'x2y4 | letter " " 'x3y4 | letter
                                        " " 'x4y4 | letter " " 'x5y4 | letter "\n"
                                    'x1y5 | letter " " 'x2y5 | letter " " 'x3y5 | letter
                                        " " 'x4y5 | letter " " 'x5y5 | letter "\n"
                            .
                        `,
                        main: "brave"
                    },
                    results: [
                        `B R A V E
                            V E B R A
                            R A V E B
                            E B R A V
                            A V E B R`
				]
			}], { timeout: 60000 * 5 }
		)
	);
});
