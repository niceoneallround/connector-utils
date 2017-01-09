/*jslint node: true, vars: true */

/*

  Fetches and Validate a PRIVACY ALGORITHM if Ok returns a structure
   { privacyAlgorithm: ,
     pSteps: ,
     thePStep: psteps[0],  only supports one step
     pActions: the actions from the one step,
     thePAction: pActions[0]
   }

  otherwise throws a PN Type Error

*/

const assert = require('assert');
const JSONLDUtils = require('jsonld-utils/lib/jldUtils').npUtils;
const MServiceUtils = require('./utils');
const moment = require('moment');
const PNDataModel = require('data-models/lib/PNDataModel');
const PN_P = PNDataModel.PROPERTY;
const util = require('util');

function execute(serviceCtx, palgId, msgId, actionMsg) {
  'use strict';
  assert(serviceCtx, 'promisePrivacyAlgorithm - serviceCtx param missing');
  assert(palgId, 'promisePrivacyAlgorithm - palgId param missing');
  assert(msgId, 'promisePrivacyAlgorithm -  msgId param missing');
  assert(actionMsg, 'promisePrivacyAlgorithm - actionMsg param missing');

  const loggingMD = {
          ServiceType: serviceCtx.name,
          FileName: 'connector-utils/promisePrivacyAlgorithm.js', };

  let result = {};

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetching-Privacy-Algorithm',
                                    privacyAlgorithmId: palgId,
                                    msgId: msgId, }, loggingMD);

  return MServiceUtils.promises.fetchMetadata(serviceCtx, palgId, {})
  .then(
    function (privacyAlgorithm) {
      result.privacyAlgorithm = privacyAlgorithm;
      serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: actionMsg + '-Fetched-Privacy-Algorithm',
                                          privacyAlgorithmId: privacyAlgorithm['@id'],
                                          msgId: msgId,
                                          metadata: privacyAlgorithm, }, loggingMD);

      // VALIDATE THAT THE PRIVACY ALGORITHM MEETS THE ASSUMPTIONS OF THE CONNECTOR CODE
      // - PA must contain only 1 step
      // - Step must only contain 1 action
      result.pSteps = JSONLDUtils.getArray(privacyAlgorithm, PN_P.privacyStep);
      if ((!result.pSteps) || (result.pSteps.length !== 1)) {
        // BAD REQUEST as handle a privacy algorithm that has one step
        let e1 = PNDataModel.errors.createTypeError({
                    id: PNDataModel.ids.createErrorId(serviceCtx.config.getHostname(), moment().unix()),
                    errMsg: util.format('%s:%s FAIL - PRIVACY ALGORITHM MUST HAVE A SINGLE PRIVACY STEP:%j',
                                actionMsg, msgId, privacyAlgorithm), });
        serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                action: actionMsg + '-ERROR-Privacy-Algorithm-CANNOT-BE-PROCESSED-NEED-ONE-STEP',
                msgId: msgId,
                privacyAlgorithmId: palgId,
                metadata: result.pSteps,
                error: e1, }, loggingMD);

        throw e1;
      } else {
        result.thePStep = result.pSteps[0];
      }

      // VALIDATE THAT THE PRIVACY ALGORITHM MEETS THE ASSUMPTIONS OF THE CONNECTOR CODE
      // CAN ONLY BE ONE ACTION
      result.pActions = JSONLDUtils.getArray(result.thePStep, PN_P.privacyAction);
      if ((!result.pActions) || (result.pActions.length !== 1)) {
        // BAD REQUEST as handle a privacy algorithm that has one step
        let e1 = PNDataModel.errors.createTypeError({
                    id: PNDataModel.ids.createErrorId(serviceCtx.config.getHostname(), moment().unix()),
                    errMsg: util.format('%s:%s FAIL - PRIVACY ALGORITHM MUST HAVE A SINGLE PRIVACY ACTION:%j',
                                actionMsg, msgId, privacyAlgorithm), });
        serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                action: actionMsg + 'ERROR-Privacy-Algorithm-CANNOT-BE-PROCESSED-NEED-ONE-ACTION',
                msgId: msgId,
                privacyAlgorithm: palgId,
                metadata: result.pActions,
                error: e1, }, loggingMD);

        throw e1;
      } else {
        result.thePAction = result.pActions[0];
      }

      serviceCtx.logger.logProgress(
        util.format('%s: %s FETCHED PRIVACY ALGORITHM PASSED ASSUMPTIONS CHECK: %s',
            actionMsg, msgId, palgId));

      return result;
    },

    function (err) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                          action: actionMsg + '-ERROR-Fetching-Privacy-Algorithm',
                                          msgId: msgId,
                                          privacyAlgorithmId: palgId,
                                          error: err, }, loggingMD);
      throw err; // let final catch handle
    }
  );
}

module.exports = {
  execute: execute,
};
