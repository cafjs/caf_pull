/*!
Copyright 2013 Hewlett-Packard Development Company, L.P.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

"use strict";

/**
 * Handles loading/refreshing external resources associated with a
 * CA. The set of resources needed are updated in a transactional manner and
 * recreated after migration/failure.
 *
 *
 * The name of this component in a ca.json description should be pull_ca.
 * 
 * @name caf_pull/plug_ca_pull
 * @namespace
 * @augments gen_transactional
 * 
 */


var caf = require('caf_core');
var genTransactional = caf.gen_transactional;
var json_rpc = caf.json_rpc;


var addResourceOp = function(alias, url, updatedMethod) {
    return {'op' : 'addResource', 'alias' : alias, 'url': url,
             'updatedMethod' : updatedMethod};
};

var removeResourceOp = function(alias) {
     return {'op' : 'removeResource', 'alias' : alias};
};

var refreshResourceOp = function(alias) {
    return {'op' : 'refreshResource', 'alias' : alias};
};

/*
 * Factory method to create a plug for this CA  to  access locally
 * cached resources. 
 * 
 */
exports.newInstance = function(context, spec, secrets, cb) {

    var $ = context;
    /*
     * Resource Type:
     * {String : {'url' : <string>, 'updatedMethod' : <string>}}
     *
     *
     */
    var resources = {};
    var logActions = [];

    var that = genTransactional.constructor(spec, secrets);

    that.addResource = function(alias, url, updatedMethod) {
        logActions.push(addResourceOp(alias, url, updatedMethod));
    };

    that.removeResource = function(alias) {
        logActions.push(removeResourceOp(alias));
    };

    that.refreshResource = function(alias) {
        logActions.push(refreshResourceOp(alias));
    };

    that.getResourceInfo = function(alias) {
        return resources[alias];
    };

    that.listResources = function() {
         return Object.keys(resources);
    };

    var newUpdateF = function(alias, methodName) {
        return function(fileName, version, cb0) {
            var cb1 = function(err, data) {
                if (err) {
                    cb0(err);
                } else {
                    if (json_rpc.isSystemError(data)) {
                        /*
                         * CA shutdown. Cleanup cached resource.
                         */
                        cb0(data);
                    } else {
                        // ignore application errors
                        cb0(err, data);
                    }
                }
            };
            // signature is function(alias, fileName, version, cb)
            var notifMsg = json_rpc.request(json_rpc.SYSTEM_TOKEN, secrets.myId,
                                            json_rpc.SYSTEM_FROM,
                                            json_rpc.SYSTEM_SESSION_ID,
                                            methodName,
                                            alias, fileName, version);
            secrets.inqMgr && secrets.inqMgr.process(notifMsg, cb1);
        };
    };

    var replayLog = function() {
        logActions.forEach(
            function(action) {
                switch (action.op) {
                case 'addResource' :
                    var res = {'url' : action.url,
                               'alias' : action.alias,
                               'updatedMethod' : action.updatedMethod};
                    resources[action.alias] = res;
                    var notifyF = newUpdateF(action.alias,
                                             action.updatedMethod);
                    $.pull_mux.addResource(secrets.myId, action.alias,
                                           action.url, notifyF);
                    break;
                case 'removeResource':
                    delete resources[action.alias];
                    $.pull_mux.removeResource(secrets.myId, action.alias);
                    break;
                case 'refreshResource':
                    $.pull_mux.refreshResource(secrets.myId, action.alias);
                    break;
                default:
                    throw new Error('CA Pull : invalid log action ' +
                                    action.op);
                }
            });
        logActions = [];
    };


    // Framework methods

    that.__ca_init__ = function(cb0) {
        resources = {};
        logActions = [];
        cb0(null);
    };

    var restore = function(target) {
      var result = [];
      for (var name in target) {
          var alias = target[name].alias;
          var url = target[name].url;
          var updatedMethod = target[name].updatedMethod;
          result.push(addResourceOp(alias, url, updatedMethod));
      }
      return result;
    };

    that.__ca_resume__ = function(cp, cb0) {
        cp = cp || {};
        resources = cp.resources || {};
        logActions = restore(resources);
        logActions = logActions.concat(cp.logActions || []);
        replayLog();
        cb0(null);
    };

    that.__ca_begin__ = function(msg, cb0) {
        logActions = [];
        cb0(null);
    };

    that.__ca_prepare__ = function(cb0) {
        var dumpState = {
            'logActions' : logActions,
            'resources' : resources
        };
        cb0(null, JSON.stringify(dumpState));
    };

    that.__ca_commit__ = function(cb0) {
        replayLog();
        cb0(null);
    };

    that.__ca_abort__ = function(cb0) {
        logActions = [];
        cb0(null);
    };

    cb(null, that);



};
