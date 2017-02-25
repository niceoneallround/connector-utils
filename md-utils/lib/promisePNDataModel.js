/*jslint node: true, vars: true */

/*

  Fetches and Validate a PN Data Model if ok
   { datamodel: the datamodel if all ok
   }

  otherwise throws a PN Type Error

*/

const assert = require('assert');
const MServiceUtils = require('./utils');

// dmId - the datamodelId
// msgId - the msgId for the log file
// actionMsg - the action message for log file
function execute(serviceCtx, dmId, msgId, actionMsg) {
  'use strict';
  assert(serviceCtx, 'PNDataModel - serviceCtx param missing');
  assert(dmId, 'PNDataModel - paId param missing');
  assert(msgId, 'PNDataModel -  msgId param missing');
  assert(actionMsg, 'PNDataModel - actionMsg param missing');

  const loggingMD = {
          ServiceType: serviceCtx.name,
          FileName: 'connector-utils/md-utils/promisePNDataModel.js', };

  let result = {};

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetching-PNDataModel',
                                    datamodelId: dmId,
                                    msgId: msgId, }, loggingMD);

  return MServiceUtils.promises.fetchMetadata(serviceCtx, dmId, {})
  .then(
    function (datamodel) {
      result.datamodel = datamodel;
      serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetched-PNDataModel',
                                          datamodelId: dmId,
                                          msgId: msgId,
                                          metadata: datamodel, }, loggingMD);
      return result;
    },

    function (err) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                          action: actionMsg + '-ERROR-Fetching-PNDataModel',
                                          msgId: msgId,
                                          datamodelId: dmId,
                                          error: err, }, loggingMD);
      throw err; // let final catch handle
    }
  );
}

module.exports = execute;
