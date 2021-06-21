const fetch = require('node-fetch')
const { Core, Events, State } = require('@adobe/aio-sdk')
const { context, getToken } = require('@adobe/aio-lib-ims')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')
const { getIMSToken, getAssetMetadata, getLatestEventPosition } = require('../aem-file-common/common-utils')
const IngestorCreator = require('../aem-file-ingestors/ingestor-creator')
const logger = Core.Logger('main', { level: 'info' })

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
    // create a Logger
    const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' });

    try {
        // 'info' is the default level if not set
        logger.info('Inside aem-file-journal/journal-consumer.js main');

        // log parameters, only if params.LOG_LEVEL === 'debug'
        //logger.debug(stringParameters(params));

        var stateCLient = await State.init();
        const imsToken = await getIMSToken(params);
        var fetch_cnt = 0;
        var total_event_num = 0;

        if (imsToken) {
            let db_event_key = 'aem-files-journal-' + params.apiKey;
            var latestEventPos = await getLatestEventPosition(db_event_key, stateCLient);
            if (latestEventPos === undefined) {
                logger.info("Fetch Event since first position");
            } else {
                logger.info("Fetch Event since position: " + latestEventPos);
            }

            var events = await fetchEventsFromJournal(params, imsToken, latestEventPos);
            while (events != undefined) {
                logger.info(`Got ${events.length} events from #${fetch_cnt} batch, and the latest event position is: ${events[events.length - 1].position}`);
                await getEventAssetsToExport(params, events);
                await saveEventsToAioState(db_event_key, events, stateCLient);

                total_event_num = total_event_num + events.length;
                fetch_cnt = fetch_cnt + 1;
                // max_events_in_batch: defines how many total event batches to fetch per invocation
                if (fetch_cnt >= params.max_events_in_batch) {
                    break;
                }
                events = await fetchEventsFromJournal(params, imsToken, events[events.length - 1].position);
            }
        }

        const response = {
            statusCode: 200,
            headers:
                { 'Content-type': 'application/json' },
            body: { event_fetched: total_event_num }
        }

        return response;

    } catch (error) {
        // log any server errors
        logger.error(error)
        // return with 500
        return errorResponse(500, 'server error', logger)
    }
}

async function getEventAssetsToExport (params, events) {
    //this is to get all evetns from one journal batch in parellel
    await Promise.all(events.map(async (event) => {
        const contentPath = event['event']['activitystreams:object']['xdmAsset:path'];
        if (contentPath.startsWith("/content/dam")) {
            await exportAemAsset(params, contentPath);
        }
    }));
}

async function exportAemAsset (params, contentPath) {
    const assetMetadata = await getAssetMetadata(params.aemAuthorHost, params.aemServiceCredentials, contentPath);
    if (assetMetadata['exportDestination'] && assetMetadata['exportImmediately'] === 'yes') {
        //export the asset immediately based on the exportDestination
        logger.info(`got exportDestination: ${assetMetadata['exportDestination']} and set to params`);
        params.fileDestination = assetMetadata['exportDestination'];
        const FileIngestor = IngestorCreator.create(params);
        await FileIngestor.init();

        logger.info(`exporting asset: "${contentPath}"`);
        await FileIngestor.ingestAemAsset(contentPath);
    }
}

async function fetchEventsFromJournal (params, imsToken, since) {
    const eventsClient = await Events.init(params.ims_org_id, params.apiKey, imsToken);

    let options = {}
    if (since != undefined) {
        options.since = since;
    }
    const journaling = await eventsClient.getEventsFromJournal(params.journaling_url, options);
    if (journaling.events === undefined) {
        logger.info('no new event found in journal');
        return undefined;
    }
    return journaling.events;
}

async function saveEventsToAioState (db_event_key, new_events, stateCLient) {
    var pastEvents = await stateCLient.get(db_event_key);
    if (pastEvents === undefined) {
        //new_events saved here is the last event batch from journal. lastest is the latest event from the last event batch. 
        //we may not need to save the whole event batch as we just need to know the latest. also there's max state value size concern (2MB)
        pastEvents = { latest: new_events[new_events.length - 1], events: new_events };
    } else {
        pastEvents = pastEvents.value;
        pastEvents.latest = new_events[new_events.length - 1];
        pastEvents.events.push(new_events);
    }
    await stateCLient.put(db_event_key, pastEvents, { ttl: -1 });
}

exports.main = main