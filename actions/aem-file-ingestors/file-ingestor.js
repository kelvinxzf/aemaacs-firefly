const { Core } = require('@adobe/aio-sdk')
const logger = Core.Logger('main', { level: 'info' })
const { getAEMAccessToken } = require('../aem-file-common/common-utils')

class FileIngestor {
    constructor(params) {
        if (!this.ingestAemAsset) {
            throw new Error("ingestAemAsset must be implemented!");
        }
        this.params = params;
    }

    async init() {
        this.aemAuthor = this.params.aemAuthorHost;
        const aemServiceCredentials = this.params.aemServiceCredentials;
        this.aemtoken = await getAEMAccessToken(JSON.parse(aemServiceCredentials));
        logger.info(`FileIngestor > init > got aem token: ${this.aemtoken}`);
    }

    async ingestAemAsset() {
        logger.info('welcome to ingestAemAsset');
    }
}

module.exports = FileIngestor;