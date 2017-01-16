/*jslint node: true, vars: true */

/*

  Fetches and Validate an IDENTITY SYNDICATION ALGORITHM if Ok returns a structure
   { isa: the isa
   }

  otherwise throws a PN Type Error

*/

const assert = require('assert');
const MServiceUtils = require('./utils');

function execute(serviceCtx, isaId, msgId, actionMsg) {
  'use strict';
  assert(serviceCtx, 'promiseIAAlgorithm - serviceCtx param missing');
  assert(isaId, 'promiseISAlgorithm - isaId param missing');
  assert(msgId, 'promiseISAlgorithm -  msgId param missing');
  assert(actionMsg, 'promiseISAlgorithm - actionMsg param missing');

  const loggingMD = {
          ServiceType: serviceCtx.name,
          FileName: 'connector-utils/promiseISAlgorithm.js', };

  let result = {};

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetching-Identity-Syndication-Algorithm',
                                    IdentitySyndicationAlgorithmId: isaId,
                                    msgId: msgId, }, loggingMD);

  return MServiceUtils.promises.fetchMetadata(serviceCtx, isaId, {})
  .then(
    function (isAlgorithm) {
      result.isa = isAlgorithm;
      serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetched-Identity-Syndication-Algorithm',
                                          IdentitySyndicationAlgorithmId: isAlgorithm['@id'],
                                          msgId: msgId,
                                          metadata: isAlgorithm, }, loggingMD);
      return result;
    },

    function (err) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                          action: actionMsg + '-ERROR-Fetching-Identity-Syndication-Algorithm',
                                          msgId: msgId,
                                          IdentitySyndicationAlgorithmId: isaId,
                                          error: err, }, loggingMD);
      throw err; // let final catch handle
    }
  );
}

module.exports = {
  execute: execute,
};
