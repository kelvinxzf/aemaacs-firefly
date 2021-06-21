const fetch = require('node-fetch')
const { Core, Files } = require('@adobe/aio-sdk')
const logger = Core.Logger('main', { level: 'info' })
const FileIngestor = require('./file-ingestor')

const EXPORTED_AEM_ASSETS_ROOT = 'aem-exported-assets';

class AzureIngestor extends FileIngestor {
    constructor(params) {
        super(params);
    }

    async init() {
        await super.init();
        //init anything else here...here we are using lib-files to init custom Azure (need to provide own Azure storage account)
        this.customAzureFilesSdk = await Files.init(
            {
                azure: {
                    storageAccount: this.params.customAzureStorageAccount,
                    storageAccessKey: this.params.customAzureStorageKey,
                    containerName: this.params.customAzureContainerName
                }
            });
    }

    async ingestAemAsset(aemAssetPath) {
        logger.info('inside AzureIngestor > ingestAemAsset');
        if (aemAssetPath) {
            const aemAssetUrl = this.aemAuthor + aemAssetPath;
            logger.info(`downloading asset from "${aemAssetUrl}" at ${new Date().toISOString()}`);
            const aemStream = await fetch(aemAssetUrl, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + this.aemtoken
                }
            });

            const bytes = await this.customAzureFilesSdk.write(EXPORTED_AEM_ASSETS_ROOT + aemAssetPath, aemStream.body);
            logger.info(`asset "${aemAssetUrl}", size: ${bytes}, is downloaded at ${new Date().toISOString()}`);
            return { 'bytesWrittenToAzure': bytes };
        }
    }
}

module.exports = AzureIngestor;