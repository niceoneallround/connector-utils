/*jslint node: true, vars: true */

/*

  Fetches and Validate a REFERENCE SOURCE if Ok returns a structure
   { rs: the rs
   }

  otherwise throws a PN Type Error

*/

const assert = require('assert');
const MServiceUtils = require('./utils');

function execute(serviceCtx, rsId, msgId, actionMsg) {
  'use strict';
  assert(serviceCtx, 'referenceSource - serviceCtx param missing');
  assert(rsId, 'referenceSource - rsId param missing');
  assert(msgId, 'referenceSource -  msgId param missing');
  assert(actionMsg, 'referenceSource - actionMsg param missing');

  const loggingMD = {
          ServiceType: serviceCtx.name,
          FileName: 'connector-utils/md-utils/promiseReferenceSource.js', };

  let result = {};

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetching-Reference-Source',
                                    referenceSourceId: rsId,
                                    msgId: msgId, }, loggingMD);

  return MServiceUtils.promises.fetchMetadata(serviceCtx, rsId, {})
  .then(
    function (referenceSource) {
      result.rs = referenceSource;
      serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetched-Reference-Source',
                                          referenceSourceId: rsId,
                                          msgId: msgId,
                                          metadata: referenceSource, }, loggingMD);
      return result;
    },

    function (err) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                          action: actionMsg + '-ERROR-Fetching-Reference-Source',
                                          msgId: msgId,
                                          referenceSourceId: rsId,
                                          error: err, }, loggingMD);
      throw err; // let final catch handle
    }
  );
}

module.exports = {
  execute: execute,
};
