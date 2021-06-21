const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const stateLib = require('@adobe/aio-lib-state')
const logger = Core.Logger('main', { level: 'info' })
const FormData = require('form-data')
const path = require('path')
const request = require('request')
const FileIngestor = require('./file-ingestor')

class MarketoIngestor extends FileIngestor {
    constructor(params) {
        super(params);
    }

    async init() {
        await super.init();
        this.state = await stateLib.init();
        this.marketoToken = await this.getMarketoAccessToken();
    }

    async ingestAemAsset(aemAssetPath) {
        logger.info('inside MarketoIngestor > ingestAemAsset');
        if (aemAssetPath) {
            const aemAssetUrl = this.aemAuthor + aemAssetPath;
            logger.info(`downloading asset from "${aemAssetUrl}" at ${new Date().toISOString()}`);

            const endpoint = this.params.marketoRestHost + "/rest/asset/v1/files.json";
            const formdata = new FormData();
            const folderJson = {
                'id': this.params.marketoFolderId,
                'type': 'Folder'
            }
            const fileName = path.basename(aemAssetPath);
            logger.info(`marketoFolderId: "${this.params.marketoFolderId}", fileName: ${fileName}`);

            formdata.append("folder", JSON.stringify(folderJson));
            formdata.append("file", request.get(aemAssetUrl).auth(null, null, true, this.aemtoken));
            formdata.append("name", fileName);

            const response = await fetch(endpoint, {
                method: 'POST',
                body: formdata,
                headers: {
                    'Authorization': 'Bearer ' + this.marketoToken
                }
            });

            const json = await response.json();
            logger.info(`Marketo created file response: ${JSON.stringify(json)} at ${new Date().toISOString()}`);
            return json;
        }
    }

    async getMarketoAccessToken() {
        let tokenKey = 'marketo-access-token-' + this.params.marketoClientId;
        let token = await this.state.get(tokenKey);
        if (token) {
            logger.info(`got marketo access token from lib state that expires at ${token.expiration}`);
            return token.value;
        }

        let access_token;
        if (this.params.marketoClientId && this.params.marketoClientSecret) {
            const endpoint = `${this.params.marketoRestHost}/identity/oauth/token?grant_type=client_credentials&client_id=${this.params.marketoClientId}&client_secret=${this.params.marketoClientSecret}`;
            const response = await fetch(endpoint, {
                method: 'GET'
            });
            const json = await response.json();
            if (json) {
                access_token = json.access_token;
                logger.info(`got marketo access_token from Marketo ${access_token} and expires in ${json.expires_in}`);

                // cache the access token with a ttl that account for a 5% leeway
                let ttl = Math.round(json.expires_in * 0.95);
                await this.state.put(tokenKey, access_token, { ttl: ttl });
                logger.info(`put marketo token into lib state that expires in ${ttl}`);
            }
        }

        return access_token;
    }
}

module.exports = MarketoIngestor;