/*jslint node: true */

/*

  Fetches and validates the Obfuscation Service Metdaata if ok returns
   { OS: the obfuscation service metadata
   }

  otherwise throws a PN Type Error

*/

const assert = require('assert');
const MServiceUtils = require('./utils');

function execute(serviceCtx, osId, msgId, actionMsg) {
  'use strict';
  assert(serviceCtx, 'promiseOS - serviceCtx param missing');
  assert(osId, 'promiseOS - keyId param missing');
  assert(msgId, 'promiseOS -  msgId param missing');
  assert(actionMsg, 'promiseOS - actionMsg param missing');

  const loggingMD = {
          ServiceType: serviceCtx.name,
          FileName: 'connector-utils/ms-utils/promiseOS.js', };

  let result = {};

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetching-Obfuscation-Service',
                                    OSId: osId,
                                    msgId: msgId, }, loggingMD);

  return MServiceUtils.promises.fetchMetadata(serviceCtx, osId, {})
  .then(
    function (OSMD) {
      result.OS = OSMD;
      serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetched-Obfuscation-Service',
                                          OSId: OSMD['@id'],
                                          msgId: msgId,
                                          metadata: OSMD, }, loggingMD);
      return result;
    },

    function (err) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                          action: actionMsg + '-ERROR-Fetching-Obfuscation-Service',
                                          msgId: msgId,
                                          OSId: osId,
                                          error: err, }, loggingMD);
      throw err; // let final catch handle
    }
  );
}

module.exports = {
  execute: execute,
};
