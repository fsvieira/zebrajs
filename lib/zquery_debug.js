/*
    Override zquery methods with checks and stuff :D
*/
var ZQuery = require("./zquery");
var should = require("should");
var fs = require("fs");

function ErrorMatchMessage (message, match) {
  this.match = match;
  this.name = "ErrorMatchMessage";
  this.message = message || 'Error Match Message';
}

ErrorMatchMessage.prototype = Object.create(Error.prototype);
ErrorMatchMessage.prototype.constructor = ErrorMatchMessage;


function Logger (options) {
    options = options || {};
    this.root = [];
    this.stack = [];
    this.stack.push(this.root);

    function checkMessage (m) {
        if (options.exceptions) 
        for (var e in options.exceptions) {
            var t = true;
            for (var field in options.exceptions[e]) {
                if (options.exceptions[e][field] !== m[field]) {
                    t = false;
                    break;                    
                }
            }
            
            if (t) {
                throw new ErrorMatchMessage("message match exception: " + JSON.stringify(m), m);
            }
        }
    }
  
    this.start = function () {
        var env = [];
        this.stack[this.stack.length-1].push(env);
        this.stack.push(env);
    };
  
    this.end = function () {
        var last = this.stack.pop();
            
        if (last.length === 0) {
            var father = this.stack[this.stack.length-1];
            father.splice(father.indexOf(last), 1);
        }
    };
  
    this.message = function (msg, status) {
        if (!options.status || options.status.indexOf(status) !== -1) {
            var m = {
                message: msg,
                status: status
            };
            
            this.stack[this.stack.length-1].push(m);
            checkMessage(m);
        }
    };
  
    this.toString = function (root) {
        root = root || this.root;
        return JSON.stringify(root, null, "\t");
    };
    
}

function logger (f, options) {
    options = options || {};

    var log = new Logger(options);

/*
    function argsToString(args) {
        var s = "";
        for (var i = 0; i< args.length; i++) {
            s += args[i] +  ";  ";
        }
        
        return s;
    }


    var revert = [];
    function hookCall(c, func) {
        var _call = ZQuery[c].prototype[func];

        revert.push(function () {
            ZQuery[c].prototype[func] = _call;
        });
        
        ZQuery[c].prototype[func] = function () {
            log.message("[START]" + c + "." + func + " : " + argsToString(arguments), "START");
            log.start();
            var r = _call.apply(this, arguments);
            log.end();
            log.message(
                c + "." + func + " : " + argsToString(arguments)
                , (c + "_" + func).toUpperCase() + "_" + r.toString().toUpperCase()
            );
        
            return r;
        };
    }

    for (var c in ZQuery) {
        for (var func in ZQuery[c].prototype) {
            hookCall (c, func);
        }
    }

    var error;
    try {
        f();
    }
    catch (err) {
        error = err;
    }

    if (options && options.log) {
        fs.writeFile(options.log, log.toString());
    }
    else {
        console.log(log.toString());
    }
    
    if (
        (error instanceof ErrorMatchMessage) &&
        options.testcase
    ) {
        console.log("gen testcase: " + options.testcase);
    }
     
    revert.forEach (function (r) {
        r();
    });

    if (error) {
        throw error;
    }
*/

    var vNotUnify = ZQuery.Variable.prototype.notUnify;
    ZQuery.Variable.prototype.notUnify = function (v) {
        
        log.message("variable not unify start: " + this.toString() + " <=> " + v.toString(), "START");
        log.start();
        var r = vNotUnify.call(this, v);
        log.end();
        log.message(
            "variable not unify end: " + this.toString() + " <=> " + v.toString()
            , "VAR_NOT_UNIFY_" + r.toString().toUpperCase()
        );
    
        should(r).be.type("boolean");
        return r;
    };

    var vunify = ZQuery.Variable.prototype.unify;
    ZQuery.Variable.prototype.unify = function (v) {
        
        log.message("variable unify start: " + this.toString() + " <=> " + v.toString(), "START");
        log.start();
        var r = vunify.call(this, v);
        log.end();
        log.message(
            "variable unify end: " + this.toString() + " <=> " + v.toString()
            , "VAR_UNIFY_" + r.toString().toUpperCase()
        );
    
        should(r).be.type("boolean");
        return r;
    };
    
    var _vunify = ZQuery.Variable.prototype._unify;

    ZQuery.Variable.prototype._unify = function (v) {
        
        log.message("variable _unify start: " + this.toString() + " <=> " + v.toString(), "START");
        log.start();
        var r = _vunify.call(this, v);
        log.end();
        log.message(
            "variable _unify end: " + this.toString() + " <=> " + v.toString()
            , "VAR_UNIFY_" + r.toString().toUpperCase()
        );
    
        should(r).be.type("boolean");
        return r;
    };
    
    var tunify = ZQuery.Tuple.prototype.unify;
    ZQuery.Tuple.prototype.unify = function (v) {
        log.message("tuple unify start: " + this.toString() + " <=> " + v.toString(), "START");
        log.start();
    
        var r = tunify.call(this, v);
        log.end();
        log.message(
            "tuple unify end:  " + this.toString() + " <=> " + v.toString()
            , "TUPLE_UNIFY_" + r.toString().toUpperCase()
        );
        should(r).be.type("boolean");
        return r;
    };
    
    var cunify = ZQuery.Constant.prototype.unify;
    ZQuery.Constant.prototype.unify = function (v) {
        log.message("constant unify start: " + this.toString() + " <=> " + v.toString(), "START");
        log.start();
        var r = cunify.call(this, v);
        log.end();
        log.message(
            "constant unify end: " + this.toString() + " <=> " + v.toString()
            , "CONST_UNIFY_" + r.toString().toUpperCase()
        );
        should(r).be.type("boolean");
        return r;
    };
    
    var rquery = ZQuery.Run.prototype._query;
    ZQuery.Run.prototype._query = function (tuple, callback) {
        log.message("query start:" + tuple.toString(), "START");
        log.start();
        rquery.call(this, tuple, callback);
        log.end();
        log.message("query end: " + tuple.toString(), "END");
    };

    var error;
    try {
        f();
    }
    catch (err) {
        error = err;
    }

    if (options && options.log) {
        fs.writeFile(options.log, log.toString());
    }
    else {
        console.log(log.toString());
    }
    
    if (
        (error instanceof ErrorMatchMessage) &&
        options.testcase
    ) {
        console.log("gen testcase: " + options.testcase);
    }
     
    ZQuery.Variable.prototype.unify = vunify;
    ZQuery.Tuple.prototype.unify = tunify;
    ZQuery.Constant.prototype.unify = cunify;
    ZQuery.Run.prototype._query = rquery;

    if (error) {
        throw error;
    }
    
}

module.exports = {
    logger: logger
};

/*
module.exports = {
    Run: ZQuery.Run,
    Variable: ZQuery.Variable,
    Tuple: ZQuery.Tuple,
    Constant: ZQuery.Constant,
    Context: ZQuery.Context,
    create: ZQuery.create
};
*/