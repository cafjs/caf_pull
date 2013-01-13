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
 * Helper class to load and cache external resources.
 *
 */
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var url = require('url');
var caf = require('caf_core');
var async = caf.async;


var configFromUrl = function(urlStr) {
    var urlObj = url.parse(urlStr);
    var port = urlObj.port ||
        ((urlObj.protocol === 'http:') ? 80 :
         ((urlObj.protocol === 'https:') ? 443 : undefined));
    var protocol = ((urlObj.protocol === 'http:') ? http :
                    // note that https as configured here is insecure
                    ((urlObj.protocol === 'https:') ? https : null));
    return {'protocol' : protocol, 'options' : { 'host' : urlObj.hostname,
                                                 'port' : port,
                                                 'path' : urlObj.pathname}};
};


var MAX_RETRIES = 10;

var loadHeadImpl = function(meta, retries,  cb) {

    var conf = configFromUrl(meta.url);
    if (!conf.protocol) {
        cb('unsupported protocol in ' + meta.url);
    } else {
        meta.protocol = conf.protocol;
        conf.options.method = 'HEAD';
        var req =
            meta.protocol.request(conf.options,
                                  function(res) {
                                      if (res.statusCode === 200) {
                                           var version = res.headers &&
                                              (res.headers.etag ||
                                               res.headers['last-modified']);
                                          if (!version) {
                                              cb(' no version in headers' +
                                                 JSON.stringify(res.headers));
                                          } else {
                                              cb(null, version);
                                          }
                                      } else if (res.statusCode > 300 &&
                                                  res.statusCode < 400 &&
                                                 res.headers.location &&
                                                 retries < MAX_RETRIES) {
                                          meta.url = res.headers.location;
                                          loadHeadImpl(meta, retries + 1, cb);
                                      } else {
                                          cb('Not found' + meta.url);
                                      }
                                  }
                                 );
        req.end();
        req.on('error', function(e) { cb(e); });
    }
};


/**
 *  meta type is {url : <string> , ...}
 *
 */
exports.loadHead = function(meta, cb) {

    loadHeadImpl(meta, 0, cb);
};


var createDir = function(dir, cb) {
    path.exists(dir, function(exists) {
                    if (exists) {
                        cb(null, 'ok');
                    } else {
                        fs.mkdir(dir, '755', function(e) {
                                     (e ? cb(e) : cb(null, 'ok'));
                                 });
                    }
                });
};



var pipeBody = function(meta, dirTopName, dirName, fileName, cb) {
    async.waterfall([
                        function(cb0) {
                            createDir(dirTopName, cb0);
                        },
                        function(ignore, cb0) {
                            createDir(dirName, cb0);
                        },
                        function(ignore, cb0) {
                            var conf = configFromUrl(meta.url);
                            meta.protocol.get(conf.options,
                                              function(res) {
                                                  var fout = fs
                                                      .createWriteStream(
                                                          fileName);
                                                  res.pipe(fout);
                                                  res.on('end', function(p) {
                                                             cb0(null, 'ok');
                                                         });
                                              }).on('error', function(e) {
                                                        cb0(e);
                                                    });
                        }
                    ],
                    function(err, ignore) {
                        cb(err, fileName);
                    });
};

var cleanF = function(str) {
    // TO DO: sanitize the input properly
    return str.replace('/', '_');
};

/**
 *  meta type is {url : <string>  , caId: <string>, alias: <string>,
 *    protocol: <module>, version: <string>...}
 *
 */
exports.loadBody = function(meta, home, subdir, cb) {

    if ((!meta.caId) || (!meta.alias) || (!meta.version)) {
        cb('Bad arguments: caId:' + meta.caId + ' alias:' + meta.alias +
           ' version:' + meta.version);
    } else {
        var dirTopName = path.resolve(path.join(home, subdir));
        var dirName = path.join(dirTopName, cleanF(meta.caId));
        var fileName = path.join(dirName, cleanF(meta.alias) + '-' +
                                 cleanF(meta.version));
        async.waterfall([
                            function(cb0) {
                                path.exists(fileName, function(exists) {
                                                cb0(null, exists);
                                            });
                            },
                            function(exists, cb0) {
                                if (exists) {
                                    cb0(null, fileName);
                                } else {
                                    pipeBody(meta, dirTopName, dirName,
                                             fileName, cb0);
                                }
                            }
                        ],
                        function(err, ignore) {
                            cb(err, fileName);
                        });

    }
};
