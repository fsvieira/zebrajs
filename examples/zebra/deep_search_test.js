var v = require("../../lib/variable").v;
var fs = require("fs");
var puzzles = require("./puzzleslib");

/* ===============
 * 	  Gen grid
 * 
 * - Note: Solution items order doesnt matter since random solutions 
 *   can be generated by item replacement.
 * ===============
 */
function genGrid (cols, lines, prefix) {
	prefix = prefix || "tvar";
	
	var r = {
		solution: [],
		posy: {},
		w: cols,
		h: lines
	};
	
	for (var y=0; y<lines; y++) {
		var vars = [];
		var domain = [];
		var strVars = [];
		for (var x=0; x<cols; x++) {
			var id = prefix + y+ "_" +x;
			domain.push(id);
			r.posy[id] = y;
		}
		r.solution.push (domain);
	}
	
	r.constrains = constrains(r);
	
	return r;
};



/* ===============
 * 		Get all possible constrains
 * 
 * - Returns a list of all possible constrains that can be applyed to grid.
 * ===============
 */
function constrains (grid) {
	var constrains = [];
	var solution = grid.solution;
	
	function getVar (yA, vA) {
		return {
			y: yA,
			v: vA
		};
	};
	
	function getClue (typeA, a, b) {
		var clue = {
			type: typeA,
			a: a,
		};
		
		if (b) {clue.b = b;}
		
		return clue;
	};

	// Gen "item" clues,
	for (var y=0; y<grid.h; y++) {
		for (var x=1; x < grid.w; x++) {
			var a = getVar(y, solution[y][x]);
			constrains.push(getClue("item", a));
		}
	}
	
	// Gen "middle" clues,
	for (var y=0; y<grid.h; y++) {
		for (var x=1; x < grid.w-1; x++) {
			var a = getVar(y, solution[y][x]);
			constrains.push(getClue("middle", a));
		}
	}
	
	// Gen "immediately to the left of" and "next to" clues,
	for (var x=0; x < grid.w-1; x++) {
		for (var y=0; y<grid.h; y++) {
			for (var y2=0; y2<grid.h; y2++) {
				// immediately to the left of,
				var a = getVar(y, solution[y][x]);
				var b = getVar(y2, solution[y2][x+1]);
				var clue = getClue("immediately to the left of", a, b);
				constrains.push(clue);
				
				// next to,
				var a = getVar(y, solution[y][x]);
				var b = getVar(y2, solution[y2][x+1]);
				var clue = getClue("next to", a, b);
				
				constrains.push(clue);
			}
		}
	}

	// Gen "same position as" clues,
	for (var x=0; x < grid.w; x++) {
		for (var y=0; y<grid.h; y++) {
			for (var y2=y+1; y2<grid.h; y2++) {
				var a = getVar(y, solution[y][x]);
				var b = getVar(y2, solution[y2][x]);
				var clue = getClue("same position as", a, b);
				
				constrains.push(clue);
			}
		}
	}
	
	return constrains;
};


function getSaveClues (grid, find) {
	var filename = "templates/template-"+ grid.w + "x" + grid.h + ".json";
	console.log("Puzzles are going to be saved to " + filename);
	var solutions = [];

	try {
		solutions = JSON.parse(fs.readFileSync (filename)).solutions; // , function (err, data) {
	}
	catch (e) {
		solutions = [];
	}

	return function (clues) {
		var r = [];
		
		clues.forEach (function (clue) {
			if (clue.b) {
				r.push({
					type: clue.type,
					a: {
						v: clue.a.v,
						y: clue.a.y
					},
					b: {
						v: clue.b.v,
						y: clue.b.y
					}
				});
			}
			else {
				r.push({
					type: clue.type,
					a: {
						v: clue.a.v,
						y: clue.a.y
					}
				});
			}
		});
		
		
		solutions.push(r);
		console.log("Save Solution: " + solutions.length);
		console.log(JSON.stringify(r));

		var w = {
			grid: {
				w: grid.w,
				h: grid.h
			},
			solutions: solutions
		};
		
		fs.writeFileSync(filename, JSON.stringify(w));
	};

};

function find (remainder, clues, test, size, max, saveClues, solutions) {
	solutions = solutions || [];
	
	// console.log("level: " + clues.length);
	
	if (solutions.length >= max) {
		return; // no need to find more solutions
	}

	// console.log("level: " + clues.length + ", remainder: " + remainder.length);
	
	if (clues.length >= size) {
		return; // nothing to do
	}
	
	var result = [];
	remainder.forEach (function (clue, index) {
		var c = clues.slice(0);
		
		c.push(clue);

		result.push({
			score: test(c),
			clues: c,
			remainder: remainder.slice(index+1)
		});
	});

	shuffle(result);
	
	result.sort(function (a, b) {
		return b.score.count-a.score.count;
	});
	
	// console.log("==== results ====");
	result.forEach (function (r) {
		
		/*if (clues.length >= 1) {
			console.log(r.score);
		}*/
		if (r.score.sol) {
			solutions.push(r.clues);
			console.log("Solution Found!");
			saveClues(r.clues);
			return; // nothing else to do
		}
		else {
			find (r.remainder, r.clues, test, size, max, saveClues, solutions);
		}
	});
	
	return solutions;
};

function shuffle(o){ //v1.0
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

function gen (w, h, size, max) {

	var grid = genGrid (w, h);
	var saveClues = getSaveClues (grid, max);

	function test (clues) {
		var stats = puzzles.solve2(grid, clues);
		
		return {
			count: stats.vcount,
			sol: stats.solution,
		};
	};

	// var solutions = genetic(grid.constrains, size, test, max, saveClues, debugClues);
	
	var solutions = find(shuffle(grid.constrains), [], test, size, max, saveClues);
	
	// toJson (grid.constrains);

	return solutions;
};

// gen(2,2,2,1);
// gen(3,2,4,1);
// gen(3,3,6,1); 
// gen(4,4,12,1);
// gen(4,4,15,1);

// gen (5, 5, 20, 1);
// gen (5, 5, 19, 2);
// gen (5, 5, 18, 2);
gen (5, 5, 17, 1);
// gen (5, 5, 16, 1);
// gen(4,4,10,1);

