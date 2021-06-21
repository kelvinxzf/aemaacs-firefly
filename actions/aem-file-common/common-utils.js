/* This file exposes some common utilities for your file operations */
const { Core } = require('@adobe/aio-sdk')
const logger = Core.Logger('main', { level: 'info' })
const stateLib = require('@adobe/aio-lib-state')
const auth = require("@adobe/jwt-auth")

async function getAEMAccessToken (developerConsoleCredentials) {
  const state = await stateLib.init();
  // This is the Service Credentials JSON object that must be exchanged with Adobe IMS for an access token
  let serviceCredentials = developerConsoleCredentials.integration;

  let tokenKey = 'aem-access-token-' + serviceCredentials.technicalAccount.clientId;
  let token = await state.get(tokenKey);
  if (token) {
    logger.info(`got aem access token from lib state that expires at ${token.expiration}`);
    return token.value;
  }

  // Use the @adobe/jwt-auth library to pass the service credentials generated a JWT and exchange that with Adobe IMS for an access token.
  // If other programming languages are used, please see these code samples: https://www.adobe.io/authentication/auth-methods.html#!AdobeDocs/adobeio-auth/master/JWT/samples/samples.md
  let response = await auth({
    clientId: serviceCredentials.technicalAccount.clientId, // Client Id
    technicalAccountId: serviceCredentials.id,              // Technical Account Id
    orgId: serviceCredentials.org,                          // Adobe IMS Org Id
    clientSecret: serviceCredentials.technicalAccount.clientSecret, // Client Secret
    privateKey: serviceCredentials.privateKey,              // Private Key to sign the JWT
    metaScopes: serviceCredentials.metascopes.split(','),   // Meta Scopes defining level of access the access token should provide
    ims: `https://${serviceCredentials.imsEndpoint}`,       // IMS endpoint used to obtain the access token from
  });

  logger.info(`got aem token from IMS and expires in ${response.expires_in}`);
  // cache the access token with a ttl that account for a 5% leeway
  let ttl = Math.round(response.expires_in / 1000 * 0.95);
  //let ttl = 20;
  await state.put(tokenKey, response.access_token, { ttl: ttl });
  logger.info(`put aem token into lib state that expires in ${ttl}`);

  return response.access_token;

}

async function getIMSToken (params) {
  //logger.info(`private_key: ${params.private_key}`);
  const config = {
    client_id: params.client_id,
    client_secret: params.client_secret,
    technical_account_email: params.technical_account_email,
    technical_account_id: params.technical_account_id,
    meta_scopes: ['ent_adobeio_sdk'],
    ims_org_id: params.ims_org_id,
    private_key: params.private_key
  };
  //logger.info(`config-> ${JSON.stringify(config)}`);
  await context.set('my_event_provider', config);
  await context.setCurrent('my_event_provider');

  const token = await getToken();
  logger.info(`got IMS token ${token}`);
  return token;
}

async function getAssetMetadata (aemAuthorHost, aemServiceCredentials, contentPath) {
  const aemtoken = await getAEMAccessToken(JSON.parse(aemServiceCredentials));
  const metadataUrl = aemAuthorHost + contentPath + "/jcr:content/metadata.json";
  const response = await fetch(metadataUrl, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + aemtoken
    }
  });

  const json = await response.json();
  logger.debug("asset metadata: " + JSON.stringify(json));
  return json;
}

async function getLatestEventPosition (db_event_key, stateCLient) {
  const events = await stateCLient.get(db_event_key);
  if (events === undefined) {
    return undefined;
  } else {
    return events.value.latest.position;
  }
}

module.exports = {
  getAEMAccessToken,
  getIMSToken,
  getAssetMetadata,
  getLatestEventPosition
}