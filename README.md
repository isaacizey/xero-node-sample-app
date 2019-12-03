# Xero Node - Sample Application

This code base is for xero-node v3.x which is for OAuth 1.0a.  

Please see the [OAuth 2.0 kitchen sync app](https://github.com/XeroAPI/xero-node-oauth2-app) for use with xero-node 4.x

## OAuth1.0a deprecation
* Early December 2019 - No new OAuth 1.0a apps created.
* Mid December 2019 - OAuth 2.0 migration endpoint available to partner apps.
* December 2020 - OAuth 1.0a no longer supported for existing integrations.


To help users get up and running with the xero-node SDK quickly, we've included a sample app that is written using the Express library.

https://xero-sample-app.herokuapp.com

### Clone the Repo

To get this sample app up and running follow these steps;

```
git clone https://github.com/XeroAPI/xero-node-sample-app
cd xero-node-sample-app
yarn
```

### Modify the sample config file

You'll then need to modify the config file available at `xero-node-sample-app/config/example_config.json`.

```javascript
{
    "appType": "partner",
    "consumerKey": "aaa",
    "consumerSecret": "bbb",
    "privateKeyPath": "C:\\keys\\privatekey.pem",
    "callbackUrl": "http://localhost:3100/access"
}
```

* The `appType` determines whether you would like to run the sample app using your public or partner credentials.
* The consumerKey/Secret should be provided depending on your app type

Save this file as: `xero-node-sample-app/config/config.json`.

### Running the Sample App

```
node xero-node-sample-app/index.js
```

You should now see the prompt `listening on http://localhost:3100`.  Browse there and enjoy.
