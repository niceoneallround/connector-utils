/*jslint node: true, vars: true */

/*

  Fetches and Validate a Privacy Agent if Ok returns a structure
   { pa: the pa if all ok
   }

  otherwise throws a PN Type Error

*/

const assert = require('assert');
const MServiceUtils = require('./utils');

function execute(serviceCtx, paId, msgId, actionMsg) {
  'use strict';
  assert(serviceCtx, 'privacyAgent - serviceCtx param missing');
  assert(paId, 'privacyAgent - paId param missing');
  assert(msgId, 'privacyAgent -  msgId param missing');
  assert(actionMsg, 'privacyAgent - actionMsg param missing');

  const loggingMD = {
          ServiceType: serviceCtx.name,
          FileName: 'connector-utils/md-utils/promisePrivacyAgent.js', };

  let result = {};

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetching-Privacy-Agent',
                                    paId: paId,
                                    msgId: msgId, }, loggingMD);

  return MServiceUtils.promises.fetchMetadata(serviceCtx, paId, {})
  .then(
    function (privacyAgent) {
      result.pa = privacyAgent;
      serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetched-Privacy-Agent',
                                          paId: paId,
                                          msgId: msgId,
                                          metadata: privacyAgent, }, loggingMD);
      return result;
    },

    function (err) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                          action: actionMsg + '-ERROR-Fetching-Privacy-Agent',
                                          msgId: msgId,
                                          paId: paId,
                                          error: err, }, loggingMD);
      throw err; // let final catch handle
    }
  );
}

module.exports = execute;
