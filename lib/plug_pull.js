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

/*
 * Loads external resources and caches them in the local filesystem.
 *
 *  The name of this component in framework.json should be pull_mux
 * 
 * @name caf_pull/plug_pull
 * @namespace
 * @augments gen_plug 
 */
var caf = require('caf_core');
var genPlug = caf.gen_plug;
var async = caf.async;
var helper = require('./plug_pull_helper');

/**
 * Factory method to create a pull service connector.
 */
exports.newInstance = function(context, spec, secrets, cb) {

    var $ = context;
    /* Type of all is {<CA Id> : {alias : {fileName : <string>,
     url : <string> ,version: <string>, caId: <string>, alias: <string>,
     updateF: <function>, queue : <worker>}}
     */
    var all = {};
    var home = $.cf.getHome();
    var subdir = spec.env.subdir || 'pull_cache';
    var that = genPlug.constructor(spec, secrets);

    var newAddResourceQueue = function() {
      return async.queue(
          function(meta, cb0) {
              async.waterfall([
                                  function(cb1) {
                                      // load head
                                      $.log && $.log.trace('begin head caid:' +
                                                           meta.caId +
                                                           ' alias:' +
                                                           meta.alias);
                                      helper.loadHead(meta, cb1);
                                  },
                                  function(newVersion, cb1) {
                                      meta.version = newVersion;
                                      $.log && $.log.trace('begin load caid:' +
                                                           meta.caId + 
                                                           ' alias:' +
                                                           meta.alias);

                                      // nop if locally cached
                                      helper.loadBody(meta, home, subdir, cb1);
                                  },
                                  function(fileName, cb1) {
                                      $.log && $.log.trace('begin update caid:'
                                                           + meta.caId + 
                                                           ' alias:' +
                                                           meta.alias);
                                       meta.fileName = fileName;
                                      // updateF should be idempotent
                                      meta.updateF(fileName, meta.version, cb1);
                                  }
                              ],
                              function(err, data) {
                                  $.log && $.log.trace('done update caid:' +
                                                       meta.caId + ' alias:' +
                                                       meta.alias);
                                  cb0(err, data);
                              });
          },1); // serialized
    };

    that.addResource = function(caId, alias, url, updateF) {
        all[caId] = all[caId] || {};
        all[caId][alias] = all[caId][alias] || {};
        var meta = all[caId][alias];
        meta.url = url;
        meta.updateF = updateF;
        meta.caId = caId;
        meta.alias = alias;
        // queue per resource to serialize file system access
        meta.queue = meta.queue || newAddResourceQueue();
        var cb0 = function(err, data) {
           // log
            if (err) {
                $.log && $.log.debug('cannot load url:' + url + ' caId:' + 
                                     caId + ' alias: ' + alias + ' got error:'
                                     + err);
            } else {
                $.log && $.log.trace('+');
            }
        };
        meta.queue.push(meta, cb0);
    };

    that.removeResource = function(caId, alias) {
        /* we don't cleanup the file system, when the node.js process dies,
         *  cloud foundry eventually will remove all the files associated to
         * that process.
         */
        delete all[caId][alias];
    };

    that.refreshResource = function(caId, alias) {
        var meta = all[caId] && all[caId][alias];
        if (!meta) {
            $.log && $.log.warn('Cannot refresh non-loaded resource:' + alias +
                                ' for CA:' + caId);
        } else {
            that.addResource(caId, alias, meta.url, meta.updateF);
        }
    };

    $.log && $.log.debug('New pull plug');
    cb(null, that);
};
