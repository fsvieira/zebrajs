// TODO: make a new parser with pegjs

// var zparser = require("../lib/zparser");
var zparser = require("./zparser");
var ZVS = require("./zvs");
var Unify = require("./unify");
var utils = require("./utils");


function planner (q, b, tuples) {
    // normalize id,
    q = b.getId(q);
    
    tuples = tuples || [];
    
    if (tuples.indexOf(q) === -1) {
        var d = b.get(q);
    
        if (b.get(d.type) === 'tuple') {
            if (!d.check || !b.get(d.check)) {
                tuples.push(q);
            }
            
            var data = b.get(d.data);
            for (var i=0; i<data.length; i++) {
                planner(data[i], b, tuples);
            }
        }
    }
    
    return tuples;
}


function clone (obj) {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
        return obj;
    }
 
    var temp = obj.constructor(); // give temp the original obj's constructor
    for (var key in obj) {
        temp[key] = clone(obj[key]);
    }
 
    return temp;
}


function prepareQuery (query) {
    query = clone(query);
    var q = [query];
    var counter = 0;

    while (q.length > 0) {
        var v = q.pop();
        
        if (v.type === 'variable' && v.data === undefined) {
            v.id = ++counter;
        }
        else if (v.type === 'tuple') {
            q = q.concat(v.data);
        }
    }

    return query;
}


function copyWithVars (p, genId) {
    p = clone(p);
    var q = [p];
    var vars = {};
    
    while (q.length > 0) {
        var v = q.pop();
        
        if (v.type === 'variable') {
            if(v.data) {
                v.id = vars[v.data] || genId.uniqueId();
                vars[v.data] = v.id;
            }
            else {
                v.id = genId.uniqueId();
            }
        }
        else if (v.type === 'tuple') {
            q = q.concat(v.data);
        }
    }
    
    return p;
}


function check (q, defs, b) {
    var r = [];

    for (var i=0; i<defs.length; i++) {
        var def = b.add(copyWithVars(b.getObject(defs[i]), b));
        // var branch = b.change("unify", [q, defs[i]]);
        var branch = b.change("unify", [q, def]);

        if (branch) {
            // convervative check,
            // this.zvs.update(b, q, {check: true});
            r = r.concat(branch);
        }
    }
    
    return r;
}


function query (q, globalsHash) {
    var r = [];
    var bs, branches;

    var globals = this.get(globalsHash);
    var defs = this.get(globals.definitions);
    
    this.update(globalsHash, {query: this.getObject(q)});

    // choose tuples to evaluate,
    var tuples = planner(q, this);
    
    if (tuples && tuples.length > 0) {
        for (var i=0; i<tuples.length; i++) {
            // check will lock this branch changes, so
            // optimistic check,
            this.update(tuples[i], {check: true});
        }
    
        for (var i=0; i<tuples.length; i++) {
            branches = check(tuples[i], defs, this);
            
            if (branches.length === 0) {
                // fail
                return [];
            }
            else {
                r.push(branches);
            }
        }

        while (r.length > 1) {
            var a = r.pop();
            var b = r.pop();
    
            var nr = [];
            
            for (var i=0; i<a.length; i++) {
                var bA = a[i];
                for (var j=0; j<b.length; j++) {
                    var bB = b[j];
                    
                    // bA * bB
                    bs = this.zvs.merge([bA, bB], "unify");
                    
                    if (bs) {
                        nr = nr.concat(bs);
                    }
                }
            }
            
            if (nr.length === 0) {
                // fail,
                return;    
            }
            
            r.push(nr);
        }
        
        r = r[0];
    }
    else {
        return [this.id];
    }

    branches = undefined;
    if (r.length > 0) {
        branches = [];
        for (var i=0; i<r.length; i++) {
            bs = this.change(
                "query", [
                    q,
                    globalsHash
                ], 
                r[i]
            );
            
            for (var j=0; j<bs.length; j++) {
                if (branches.indexOf(bs[j]) === -1) {
                    branches.push(bs[j]);
                }
            }
        }
    }

    return branches;
}

function definitions (defsHash, globalsHash) {
    var defs = this.getObject(defsHash);
    var globals = this.getObject(globalsHash);
    
    globals.definitions = globals.definitions || [];

    for (var i=0; i<defs.length; i++) {
        var d = defs[i];
        if (globals.definitions.indexOf(d) === -1) {
            globals.definitions.push(d);
        }
    }
    
    // update definitions,
    this.update(globalsHash, {definitions: globals.definitions});
    
    return true;
}


/*
    Query, END
*/

/*
function copy (def, prefix) {
    var variables = {};
    def = Object.assign({}, def);
    var id = 0;
    
    function rename (v) {
        if (v.type === 'tuple') {
            for(var i=0; i<v.data.length; i++) {
                rename(v.data[i]);
            }
        }
        else if (v.type === 'not') {
            rename(v.data, variables);
        }
        else if (v.type === 'variable') {
            if (v.data === undefined || v.data === '') {
                // anonimous variable, set name,
                v.data = prefix + ":" + id++;
            }
            else {
                var vname = variables[v.data] || prefix + ":" + id++;
                variables[v.data] = vname;

                // rename variable,
                v.data = vname;
            }
        }
    }
    
    rename(def);
    
    return def;
}
*/

// zvs functions end.

function Run () {
    this.definitions = [];
    this.definitionsCodes = [];
    
    this.zvs = new ZVS()
        .action("definitions", definitions)
        .action("query", query);

    this.unify = new Unify(this.zvs);

    // this.add(defs);
    
    // var self = this;
    
    // Store global data on zvs,
    this.globalsHash = this.zvs.add({type: "globals"});
}


Run.prototype.parse = function (defs) {
    if (defs) {
        if (typeof defs === 'string') {
    		defs = zparser.parse(defs);
    		defs = {
    		    definitions: defs.filter(function (def) {
    		        return def.type !== 'query';
    		    }),
    		    queries: defs.filter(function (def) {
    		        return def.type === 'query';
    		    }).map(function (q) {
    		        return q.data;
    		    })
    		};
    	}
    	else {
    	    defs = clone(defs);
    	}
    }

    return defs;  
};

// TODO: return a promisse!!
Run.prototype.add = function (defs) {
    var result;
    
    defs = this.parse(defs);

    this.definitions = this.definitions.concat(defs.definitions || defs);
    
    if (defs.queries && defs.queries.length > 0) {
        var branch = this.zvs.change(
            "definitions", [
                this.zvs.add(this.definitions), 
                this.globalsHash
            ]
        );
        
        result = {
            definitions: branch
        };

        result.queries = {};

        for (var i=0; i<defs.queries.length; i++) {
            var q = this.zvs.add(
                prepareQuery(defs.queries[i])
            );
            result.queries[q] = this.zvs.change(
                "query", 
                [
                    q,
                    this.globalsHash
                ],
                branch
            );
        }
    }
    
    return result;
};

Run.prototype.query = function (defs) {
    var r = this.add(defs);
    var b, o, globals;
    
    var objs = [];
    
    if (r.queries) {
        for (var query in r.queries) {
            var branches = r.queries[query];
            for (var i=0; i< branches.length; i++) {
                // TODO: remove arrays inside arrays,
                b = branches[i];
                globals = this.zvs.getData(b, this.globalsHash);
                o = this.zvs.getObject(globals.query, b);
                
                objs.push(o);
            }
        }
    }
    
    return objs;
};

Run.prototype.print = function (defs) {
    return this.query(defs).map(function (o) {
        return utils.toString(o, true);
    }).join('\n');
};

module.exports = Run;