var Z = require("./z");
var parser = require("./zparser");

/* TODO: singletone constant ?? */
function Constant (value) {
    this.value = value;
}

function Ignore () {}
var IGNORE = new Ignore();

function Variable (name) {
    this.name = name;
    this.share = {
        equals: [this],
        notEquals: [],
        update: true
    };
}

function Tuple (tuple) {
    this.tuple = tuple;
}

/* ToString */
Ignore.prototype.toString = function () {
	return "_";
};

Constant.prototype.toString = function () {
	return this.value;
};

Tuple.prototype.toString = function () {
	var s = "";
	this.tuple.forEach (function (e) {
		if (s !== "") {
			s +=" ";
		}
		s+=	e.toString();
	});
	
	return "(" + s + ")";
};

Variable.prototype.toString = function () {
	var value = this.getValue();
	var s =  "'" + (this.name || "");
	
	if (value !== undefined) {
		s += " = " + value.toString();
	}
	
	return s;
};

/* Get All Shares */

/*  Get All Shares Ignore */
/* Get All Shares Constant */
Constant.prototype.getAllShares = Ignore.prototype.getAllShares = function () {
  // nothing to do, constant as no vars.
  return [];
};

/* Get All Shares Variable */
Variable.prototype.getAllShares = function (stop) {
	stop = stop || [];
	var share = cloneShare(this.share);
	if (stop.indexOf(share) === -1) {
		stop.push(share);
		
		for (var i=0; i<this.share.equals.length; i++) {
			this.share.equals[i].getAllShares(stop);
		}
			
		for (var i=0; i<this.share.notEquals.length; i++) {
			this.share.notEquals[i].getAllShares(stop);
		}
	}
	
	return stop;
};

/* Get All Shares Tuple */
Tuple.prototype.getAllShares = function (stop) {
	stop = stop || [];

	for (var i=0; i<this.tuple.length; i++) {
		this.tuple[i].getAllShares(stop);
	}

	return stop;
};

/* Save & Load */
/* Load */
function loadShares (shares) {
	for (var i=0; i<shares.length; i++) {
		var share = copyShare(shares[i]);

		share.equals.forEach(function (equal) {
			equal.share = share;
		});
	}
}

/* Save */
Constant.prototype.save = Ignore.prototype.save = function () {
	return function () {};
};

Variable.prototype.save = function () {
	var shares = this.getAllShares();
	
	return function () {
		loadShares(shares);
	};
};

Tuple.prototype.save = function () {
	var shares = this.getAllShares();
	
	return function () {
		loadShares(shares);
	};
};


/* Get Value */
Ignore.prototype.getValue = function () {};

/* Get Value Constant */
Constant.prototype.getValue = function () {
	return this.value;
};

/* Get Value Tuple */
Tuple.prototype.getValue = function () {
	// return this.tuple;
	return this;
};

/* Get Value Tuple */
Variable.prototype.getValue = function (stop) {
	stop = stop || [];
	if (stop.indexOf(this) === -1) {
		stop.push(this);
		for (var i=0; i<this.share.equals.length; i++) {
			var value = this.share.equals[i].getValue(stop);
			if (value !== undefined) {
				return value;
			}
		}
	}
};


/* Unify */
Ignore.prototype._unify = function () {
	return true;
};

Ignore.prototype.unify = Ignore.prototype._unify;

/* Unify Constant */
Constant.prototype.unify = function (v) {
	if (v instanceof Constant) {
		return this.getValue() === v.getValue();
	}
	else if (v instanceof Variable) {
		return v.unify(this);
	}
	else if (v instanceof Ignore) {
		return true;
	}
	
	// A constant cant be unifyed with anything else...
    return false;
};

Constant.prototype._unify = Constant.prototype.unify;

/* Unify Tuple */
Tuple.prototype.unify = function (v) {
	if (v instanceof Tuple) {
		var tupleA = v.tuple;
		var tupleB = this.tuple;

		if (tupleA.length === tupleB.length) {
			for (var i=0; i<tupleA.length; i++) {
				if (!tupleA[i].unify(tupleB[i])) {
					return false;
				}
			}

			return true;
		}
	}
	else if (v instanceof Variable) {
		return v.unify(this);
	}
	else if (v instanceof Ignore) {
		return true;
	}
	
	// Tuple can't unify with anything else.
	return false;
};

Tuple.prototype._unify = Tuple.prototype.unify;

/* Unify Variable */
Variable.prototype.unify = function (v) {
	if (v instanceof Ignore) {
		return true;
	}
	else if (this._unify(v)) {
        /* make all equals share the same share...*/
    	for (var i=0; i<this.share.equals.length; i++) {
    	    var e = this.share.equals[i];
    	    if (e.share) {
    	        e.share = this.share;
    	    }
    	}
    	
    	this.share._clone = undefined; // make sure to clone it again.
    	
    	return true;
    }

    return false;
};

Variable.prototype._unify = function (v) {
	
	if (!(v instanceof Ignore) && (this.share.equals.indexOf(v) === -1)) {
		this.share.equals.push(v);
		
		for (var i=0; i<this.share.equals.length; i++) {
			if (!this.share.equals[i]._unify(v)) {
				return false; // unable to unify variable.
			}
		}
			
		if (v._unify(this)) {
			for (var i=0; i<this.share.notEquals.length; i++) {
				if (!this.share.notEquals[i]._notUnify(v)) {
					return false; // unable to not-unify variable.
				}
			}
			
			return true;
		}

		return false;
	}

	return true;
};

/* NotUnify */
Ignore.prototype._notUnify = function () {return true;};
Ignore.prototype._notUnify = Ignore.prototype.notUnify;

/* NotUnify Constant */
Constant.prototype._notUnify = function (v) {
	if (v instanceof Constant) {
		return this.getValue() !== v.getValue();
	}
	else if (v instanceof Variable) {
		return v.notUnify(this);
	}

	// Anything else is not-unifable with constant.
	return true;
};

Constant.prototype.notUnify = Constant.prototype._notUnify;

/* NotUnify Variable */
Variable.prototype.notUnify = function (v) {
	if (this._notUnify(v)) {
        this.share._clone = undefined;
        return true;    
    }
    
    return false;
};

Variable.prototype._notUnify = function (v) {
	if (!(v instanceof Ignore) && (this.share.notEquals.indexOf(v) === -1)) {
		this.share.notEquals.push(v);
		
		for (var i=0; i<this.share.equals.length; i++) {
			if (!this.share.equals[i]._notUnify(v)) {
				return false; // unable to not-unify variable.
			}
		}
		
		return v.notUnify(this);
	}
	
	return true;
};

Tuple.prototype._notUnify = function (v) {
	if (v instanceof Tuple) {
		var tupleA = v.tuple;
		var tupleB = this.tuple;
		
		if (tupleA.length === tupleB.length) {
			var load = this.save();
			var loadV = v.save();

			for (var i=0; i<tupleA.length; i++) {
				if (tupleA[i].notUnify(tupleB[i])) {
					// success: at least one element is not-unifable,
					loadV();
					load();
					return true;
				}
			}
			
			loadV();
			load();
			return false;
		}
	}
	else if (v instanceof Variable) {
		return v.notUnify(this);
	}
	
	// Tuple are not-unfiable with anything else.
	return true;
	
};

Tuple.prototype.notUnify = Tuple.prototype._notUnify;

function cloneShare (share) {
	return (share._clone = share._clone || copyShare(share));
}

function copyShare (share) {
	return {
		equals: share.equals.slice(0),
		notEquals: share.notEquals.slice(0)
	};
}


/* 
    ===========================
       definition,
    ===========================
*/
function create (d, context) {
	context = context || {};

    switch (d.type) {
        case "variable": 
        	var v;
        	if (d.name && (d.name !== "")) {
        		context[d.name] = v = context[d.name] || new Variable(d.name);
        	}
        	else {
        		v = new Variable();
        	}

            if (d.notEqual) {
                v.notUnify(create(d.notEqual, context));
            }
            
            return v;
        
        case "constant":
            return new Constant(d.value);
        
        case "tuple":
            var t = [];
            for (var i=0; i< d.tuple.length; i++) {
                t.push(create(d.tuple[i], context));
            }
            
            return new Tuple(t);
        
        case "ignore":
        	return IGNORE;
    }
    
    throw Error("Unrecongized type " + d.type + ", obj= " + JSON.stringify(d, null, "\t"));
}

/*
  Run defintion,
*/

// TODO: update code to use add insted of constructor
function Run (definitions) {
	this.definitions = [];
	this.add(definitions || []);
}

Run.prototype.add = function (definitions, runQueries) {
	if ((typeof definitions) === "string") {
		var results = this.parse(definitions);
		this.definitions = this.definitions.concat(results.definitions);

		if (runQueries && (results.queries.length > 0)) {
			for (var i=0; i<results.queries.length; i++) {
				var q = results.queries[i];
				var code;
				if (q.code) {
					code = eval(q.code);
				}
				
				var r = this.queryArray(q.tuple, code, runQueries);
				
				console.log("---");
				for (var j=0; j<r.length; j++) {
					console.log(r[j]);
				}
				
				console.log("==> total results: " + r.length);
			}
		}
	}
	else {
    	this.definitions = this.definitions.concat(definitions);
	}
};

Run.prototype._query = function (q, callback) {
	var load = q.save();
	var tuple = q.getValue().tuple;

	for (var i=0;i < this.definitions.length; i++) {
        var p = this.definitions[i];
        p = create(p);

        if (p.unify(q)) {
			var cb = function () {
				callback(q);
        	};
        	
        	var run = this;
        	
        	for (var j=0; j<tuple.length; j++) {
        		if (!(p.tuple[j] instanceof Ignore)) {
        			var v;
        			
        			if (p.tuple[j] instanceof Variable) {
        				v = p.tuple[j];
        			}
        			else {
	        			v = tuple[j];
        			}

	        		if (v.getValue() instanceof Tuple) {
	        			cb = function (v, cb) {
	        				return function () {
		        				run._query(
		        					v,
		        					cb
		        				);
	        				};
	        			}(v, cb);
	        		}
        		}
        	}

       		cb();
        }

        load();
    }
};

Run.prototype.query = function (tuple, callback) {
	if ((typeof tuple) === "string") {
		// TODO: normalize string input to parse as a query ?(...) format.
		tuple = this.parse(tuple).definitions[0];
	}

    var q = create(tuple);

    this._query(q, callback);
};


// Run Utils
function result (q) {
	return q.toString();
}

Run.prototype.queryArray = function (tuple, format, stop) {
	format = format || result;
	
	if ((typeof tuple) === "string") {
		// TODO: normalize string input to parse as a query ?(...) format.
		tuple = this.parse(tuple).definitions[0];
	}
	
	var results = [];

	try {
		this.query(tuple, function (q) {
			results.push(format(q));
			if (stop >=0) {
				if (--stop === 0) {
					throw "Max results reached!";
				}
			}
		});
	}
	catch (e) {
		if (e !== "Max results reached!") {
			throw e;
		}
	}
	
	return results;
};

Run.prototype.parse = function (code) {
	return parser.parse(code);
};



module.exports = {
    Run: Run,
    Variable: Variable,
    Tuple: Tuple,
    Constant: Constant,
    create: create,
    Ignore: Ignore,
    IGNORE: IGNORE
};