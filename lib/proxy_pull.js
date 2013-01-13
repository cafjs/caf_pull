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
 * Proxy that enables a CA to access locally cached resources.
 *
 * @name caf_pull/proxy_pull
 * @namespace
 * @augments gen_proxy
 *
 */
var caf = require('caf_core');
var genProxy = caf.gen_proxy;

/*
 * Factory method to create a proxy to  access locally cached resources.
 * 
 */
exports.newInstance = function(context, spec, secrets, cb) {

    var that = genProxy.constructor(spec, secrets);
    var pull = secrets.pull_ca;

    /**
     * Adds a resource to be tracked and cached.
     * 
     * The signature of the CA method to be called when the resource
     * changes (`updatedMethod`) is:
     * 
     *       function(alias:string, fileName:string, version:string, cb:caf.cb)
     * 
     * where alias is the name of the resource, fileName is the full path/name
     * to the locally cached resource, version changes with the
     * contents (ETag in http header), and cb is a callback
     *  
     * @param {string} alias A name for this resource.
     * @param {string} url A url to locate this resource.
     * @param {string} updatedMethod A CA method name to be called
     * when the resource  changes.
     * 
     * @name caf_pull/proxy_pull#addResource
     * @function 
     * 
     */
    that.addResource = function(alias, url, updatedMethod) {
        pull.addResource(alias, url, updatedMethod);
    };

    /**
     * Stops caching a resource.
     * 
     * @param {string} alias A name for this resource.
     * 
     * @name caf_pull/proxy_pull#removeResource
     * @function
     */
    that.removeResource = function(alias) {
        pull.removeResource(alias);
    };

    /**
     * Forces a refresh of the status of the resource.
     * 
     * @param {string} alias A name for this resource.
     * 
     * @name caf_pull/proxy_pull#refreshResource
     * @function
     */
    that.refreshResource = function(alias) {
        pull.refreshResource(alias);
    };

   /**
     * Gets info associated to a cached resource.
     * 
     * @param {string} alias A name for this resource.
     * 
     * @return {{url: string, alias: string, updatedMethod}} Info on
     * this resource.
     * 
     * @name caf_pull/proxy_pull#getResourceInfo
     * @function
     */
    that.getResourceInfo = function(alias) {
        return pull.getResourceInfo(alias);
    };

   /**
     * Lists all the resources currently cached.
     * 
     * @return {Array.<string>} A list with all the resources cached.
     * @name caf_pull/proxy_pull#listResources
     * @function
     */
    that.listResources = function() {
        return pull.listResources();
    };

    Object.freeze(that);
    cb(null, that);
};
