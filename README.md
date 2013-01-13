# CAF (Cloud Assistant Framework)

Co-design permanent, active, stateful, reliable cloud proxies with your web app.

See http://www.cafjs.com 

## CAF Extra Lib Pull

This repository contains a CAF extra lib to cache locally, and check for changes, remote files identified by a URL.


## API

    lib/proxy_pull.js

See the Turtles example application (combine with `caf_deploy`).
 
## Configuration Example

### framework.json

       "plugs": [
        {
            "module": "caf_pull/plug",
            "name": "pull_mux",
            "description": "Shared connection to a service that caches files locally\n Properties: \n",
            "env": {

            }
        },
                

### ca.json

    "internal" : [
        {
            "module": "caf_pull/plug_ca",
            "name": "pull_ca",
            "description": "Provides a  service  to cache files locally for this CA",
            "env" : {

            }
        },
        ...
     ]
     "proxies" : [
        {
            "module": "caf_pull/proxy",
            "name": "pull",
            "description": "Access to a service to cache files locally",
            "env" : {

            }
        },
        ...
      ]
  
  
    
        
            
 
