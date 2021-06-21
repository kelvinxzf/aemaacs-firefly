const { Core } = require('@adobe/aio-sdk')
const logger = Core.Logger('main', { level: 'info' })
const AzureIngestor = require('./azure-ingestor')
const MarketoIngestor = require('./marketo-ingestor')

class IngestorCreator {
    create (params) {
        switch (params.fileDestination) {
            case 'azure':
                return new AzureIngestor(params);
            case 'marketo':
                return new MarketoIngestor(params);
            default:
                logger.error('Unknown ingestor type...');
        }
    }
}

module.exports = new IngestorCreator();