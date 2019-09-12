"use strict";

const test = require("../test-utils/test");
const ZTL = require("ztl");

describe("Func tests.", () => {
	it("Custom function for print query.",
		test(
			`
            (yellow)
            `, [{
					query: "?(yellow)",
					postProcessing: r => {
						const ztl = new ZTL();
						ztl.compile("print: ('v) -> 'v.");

						return ztl.fn.print(r);
					},
					results: [
						"yellow"
					]
				},
				{
					query: "?(yellow)",
					postProcessing: r => "do it",
					results: [
						"do it"
					]
				}
			]
		)
	);

	const ztl = new ZTL();
	ztl.compile(`
		mother:
			(mother (female 'mother) (female 'daughter) ') ->
				"" 'daughter " is " 'mother " daughter.",

			(mother (female 'mother) (male 'son) ') ->
				"" 'son " is " 'mother " son."
		.
	`);

	it("brother test.",
		test(
			`(male rolando)
            (female noémia)

            (female joana)
            (female isabel)
            (male filipe)

            (parent (female noémia) (female joana))
            (parent (female noémia) (female isabel))
            (parent (female noémia) (male filipe))

            (parent (male rolando) (female joana))
            (parent (male rolando) (female isabel))
            (parent (male rolando) (male filipe))

            (father (male 'x) ('y 'z) (parent (male 'x) ('y 'z)))
            (mother (female 'x) ('y 'z) (parent (female 'x) ('y 'z)))
            `, [{
				query: "?(mother ' ' ')",
				postProcessing: r => ztl.fn.mother(r),
				results: [
					"filipe is noémia son.",
					"isabel is noémia daughter.",
					"joana is noémia daughter."
				]
			}],
            {
                timeout: 1000 * 60
			}
		)
	);

});
