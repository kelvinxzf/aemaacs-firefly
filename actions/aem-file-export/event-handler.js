const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')
const logger = Core.Logger('main', { level: 'info' })
const { getAEMAccessToken, getAssetMetadata } = require('../aem-file-common/common-utils')
const IngestorCreator = require('../aem-file-ingestors/ingestor-creator')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Inside aem-file-export/event-handler.js main');
    //logger.info(stringParameters(params));

    if (Object.keys(params).length > 0) {
      const event = params.event;
      const contentPath = event['activitystreams:object']['xdmAsset:path'];

      let responseBody;
      if (contentPath.startsWith("/content/dam")) {
        logger.info("asset content path:" + contentPath);
        const assetMetadata = await getAssetMetadata(params.aemAuthorHost, params.aemServiceCredentials, contentPath);
        if (assetMetadata['exportDestination'] && assetMetadata['exportImmediately'] === 'yes') {
          //export the asset immediately based on the exportDestination
          logger.info(`got exportDestination: ${assetMetadata['exportDestination']} and set to params`);
          params.fileDestination = assetMetadata['exportDestination'];
          const FileIngestor = IngestorCreator.create(params);
          await FileIngestor.init();

          logger.info(`exporting asset: "${contentPath}"`);
          responseBody = await FileIngestor.ingestAemAsset(contentPath);
        }

        const response = {
          statusCode: 200,
          headers:
            { 'Content-type': 'application/json' },
          body: JSON.stringify(responseBody)
        }

        return response;
      }
    }

  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
