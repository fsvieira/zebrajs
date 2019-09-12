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
					`@(number @id$0=[0, 1, 2, 3])`
				]
			}],
			{
				timeout: 1000 * 60 * 5
			}
		)
	);

	it("should make domain of two variables",
		test(
			`
			('x = 'x)
			(number 0)
			(number 1)
			(number 2)
			(number 3)
			((number 'x) (number 'y))
			`, [{
				query: "?((number 'x) (number 'y))",
				results: [
					"@(@(number @id$3=[0, 1, 2, 3]) @(number @id$3=[0, 1, 2, 3]))",
					"@(@(number @id$4=[0, 1, 2, 3]) @(number @id$3=[1, 2, 3, 0]))"
				]
			}, {
				query: "?((number 'x) (number 'y) ^('x = 'y))",
				results: [
					// TODO: remove duplicated negations ?? 
					"@(@(number @id$6=[0, 1, 2, 3]) @(number @id$5=[1, 2, 3, 0]))[^!(@id$6=[0, 1, 2, 3] = @id$5=[1, 2, 3, 0]) !(@id$6=[0, 1, 2, 3] = @id$5=[1, 2, 3, 0])]"
				]
			}],
			{
				timeout: 1000 * 60 * 5
			}
		)
	);

	it("should make domain of three variables",
		test(
			`
			(0 & 0 = 0)
			(0 & 1 = 0)
			(1 & 0 = 0)
			(1 & 1 = 1)
			`, [{
				query: "?('a & 'b = 'c)",
				results: [
					/*
						0 & 1 = 0
						1 & 0 = 0
					*/
					"@(@id$2=[0, 1] & @id$1=[1, 0] = 0)",

					/*
						0 & 0 = 0
						1 & 1 = 1
					*/
					"@(@id$2=[0, 1] & @id$2=[0, 1] = @id$2=[0, 1])"
						
					/*
						@(0 & 1 = 0)
						@(1 & 0 = 0)
					*/
				]
			}],
			{
				timeout: 1000 * 60 * 5
			}
		)
	);

	it("should create domains cartasian product result",
		test(
			`
			(bit 0)
			(bit 1)
			(list)
            (list (bit 'x) (list ' '))
			(list (bit 'x) (list))
			`, [{
				query: "?(list 'x (list 'y (list)))",
				results: [
					"@(list @(bit @3$2=[0, 1]) @(list @(bit @3$3=[1, 0]) @(list)))",
      		"@(list @(bit @3$3=[0, 1]) @(list @(bit @3$3=[0, 1]) @(list)))"
				]
			}],
			{
				timeout: 1000 * 60 * 5
			}
		)
	);

	it("should create domains cartesian product result (unfold)",
		test(
			`
			(bit 0)
			(bit 1)
			(unfold 0 (bit 'a) ')
			(unfold 1 (bit 'b) (unfold 0 ' '))
			(unfold 2 (bit 'c) (unfold 1 ' '))
			`, [{
				query: "?(unfold 2 ' ')",
				results: [
					"@(unfold 2 @(bit @3$2=[0, 1]) @(unfold 1 @(bit @3$2=[0, 1]) @(unfold 0 @(bit @3$2=[0, 1]) ')))",
					// 0 0 0
					// 1 1 1

					"@(unfold 2 @(bit @3$2=[0, 1]) @(unfold 1 @(bit @3$2=[0, 1]) @(unfold 0 @(bit @9$1=[1, 0]) ')))",
					// 0 0 1
					// 1 1 0

					"@(unfold 2 @(bit @3$2=[0, 1]) @(unfold 1 @(bit @4$2=[1, 0]) @(unfold 0 @(bit @3$2=[0, 1]) ')))", 
					// 0 1 0
					// 1 0 1

					"@(unfold 2 @(bit @3$2=[0, 1]) @(unfold 1 @(bit @9$1=[1, 0]) @(unfold 0 @(bit @9$1=[1, 0]) ')))"
					// 1 0 0
					// 0 1 1
				]
			}],
			{
				timeout: 1000 * 60 * 5
			}
		)
	);
});

