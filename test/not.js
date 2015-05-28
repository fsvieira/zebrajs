var should = require("should");
var Z = require("../lib/z");
var ZQuery = require("../lib/zquery");
var log = require("../lib/zquery_debug");

describe('ZQuery Tests.', function() {
    describe('Not Tests', function() {
        /*it('Should test the Not Constants', function () {
            var run;
            run = new ZQuery.Run(Z.d(
                Z.t(Z.c("color"), Z.c("yellow")),
                Z.t(Z.c("color"), Z.c("blue")),
                Z.t(Z.c("color"), Z.c("red")),
                Z.t(Z.c("color"), Z.c("white")),
                Z.t(Z.c("notYellow"), Z.t(Z.c("color"), Z.n(Z.c("yellow"))))
            ));
            
            should(run.queryArray(
                Z.t(Z.c("color"), Z.v())
            )).eql([
                "(color ' = yellow)",
                "(color ' = blue)",
                "(color ' = red)",
                "(color ' = white)"
            ]);
            
            should(run.queryArray(
                Z.t(Z.c("notYellow"), Z.v())
            )).eql([
                "(notYellow ' = (color ' = blue))",
                "(notYellow ' = (color ' = red))",
                "(notYellow ' = (color ' = white))"
            ]);
        });
        
        it('Should declare a Not-Equal', function () {
            var run;
            run = new ZQuery.Run(Z.d(
                Z.t(Z.c("equal"), Z.v("p"), Z.v("p")),
                Z.t(Z.c("notEqual"), Z.v("p"), Z.n(Z.v("p")))
            ));
            
            should(run.queryArray(
                Z.t(Z.c("equal"), Z.c("yellow"), Z.c("yellow"))
            )).eql([
                "(equal yellow yellow)"
            ]);
            
            should(run.queryArray(
                Z.t(Z.c("equal"), Z.c("yellow"), Z.c("blue"))
            )).eql([]);
            
            
            should(run.queryArray(
                Z.t(Z.c("notEqual"), Z.c("yellow"), Z.c("yellow"))
            )).eql([]);
            
            should(run.queryArray(
                Z.t(Z.c("notEqual"), Z.c("yellow"), Z.c("blue"))
            )).eql([
                "(notEqual yellow blue)"
            ]);
        });

        it('Should make distinct tuples', function () {
            var run;
            run = new ZQuery.Run(
                "(color yellow)" +
                "(color blue)" +
                "(color red)" +
                "(distinct 'item ^'item)"
            );
            
            should(run.queryArray("(distinct (color yellow) (color yellow))")).eql([]);
            should(run.queryArray("(distinct (color blue) (color yellow))")).eql([
                "(distinct (color blue) (color yellow))"
            ]);
            
            should(run.queryArray("(distinct (color 'a) (color 'b))")).eql([
                "(distinct (color 'a = blue) (color 'b = yellow))",
                "(distinct (color 'a = red) (color 'b = yellow))",
                "(distinct (color 'a = yellow) (color 'b = blue))",
                "(distinct (color 'a = red) (color 'b = blue))",
                "(distinct (color 'a = yellow) (color 'b = red))",
                "(distinct (color 'a = blue) (color 'b = red))"
            ]);
        });

        it('Should declare a Set (inv)', function () {
            var run;
            run = new ZQuery.Run(
                "(number 0)" +
                "(number 1)" +
                "(set)" +
                "(set 'item (set) ')" +
                "(set ^'item (set 'item 'tail ') (set ^'item 'tail '))"
            );
            
            should(run.queryArray("(set (number 'a) (set (number 'b) (set) ') ')")).eql([
                "(set (number 'a = 1) (set (number 'b = 0) (set) ') ' = (set ' 'tail = (set) '))",
                "(set (number 'a = 0) (set (number 'b = 1) (set) ') ' = (set ' 'tail = (set) '))"
            ]);
        });
*/

        it('Should declare simple not.', function () {
            var run;
            run = new ZQuery.Run(
                "(number 0)" +
                "(number 1)" +
                "(not 'a ^'a)"
            );
            
            should(run.queryArray("(not (number 'p) (number 'q))")).eql([
                "(not (number 'p = 1) (number 'q = 0))",
                "(not (number 'p = 0) (number 'q = 1))"
            ]);
        });
        
        /* TODO: fix this bug...
        it('Should declare a Set', function () {
            var run;
            run = new ZQuery.Run(
                "(number 0)" +
                "(number 1)" +
                "(set)" +
                "(set 'item (set) ')" +
                "(set 'item (set ^'item 'tail ') (set 'item 'tail '))"
            );
            
            should(run.queryArray("(set (number 'a) (set (number 'b) (set) ') ')")).eql([
                "(set (number 'a = 0) (set (number 'b = 1) (set) ') ' = (set 'item = (number 'a = 0) 'tail = (set) '))",
                "(set (number 'a = 1) (set (number 'b = 0) (set) ') ' = (set 'item = (number 'a = 1) 'tail = (set) '))"
            ]);
        });*/
    });
});