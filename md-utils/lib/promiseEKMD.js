/*jslint node: true */

/*

  Fetches and validates the Encrypt Key Metadata if ok returns
   { EKMD: the encrypt key metadata
   }

  otherwise throws a PN Type Error

*/

const assert = require('assert');
const MServiceUtils = require('./utils');

function execute(serviceCtx, keyId, msgId, actionMsg) {
  'use strict';
  assert(serviceCtx, 'promiseEKMD - serviceCtx param missing');
  assert(keyId, 'promiseEKMD - keyId param missing');
  assert(msgId, 'promiseEKMD -  msgId param missing');
  assert(actionMsg, 'promiseEKMD - actionMsg param missing');

  const loggingMD = {
          ServiceType: serviceCtx.name,
          FileName: 'connector-utils/ms-utils/promiseEKMD.js', };

  let result = {};

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetching-EncryptKey-Metadata',
                                    encryptKeyMetadataId: keyId,
                                    msgId: msgId, }, loggingMD);

  return MServiceUtils.promises.fetchMetadata(serviceCtx, keyId, {})
  .then(
    function (keyMD) {
      result.EKMD = keyMD;
      serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetched-EncryptKey-Metadata',
                                          encryptKeyMetadataId: keyMD['@id'],
                                          msgId: msgId,
                                          metadata: keyMD, }, loggingMD);
      return result;
    },

    function (err) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                          action: actionMsg + '-ERROR-Fetching-EncryptKey-Metadata',
                                          msgId: msgId,
                                          encryptKeyMetadataId: keyId,
                                          error: err, }, loggingMD);
      throw err; // let final catch handle
    }
  );
}

module.exports = {
  execute: execute,
};
