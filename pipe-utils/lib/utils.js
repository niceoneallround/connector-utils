/*jslint node: true, vars: true */

const apigwRequestWrapper = require('node-utils/apigwRequestWrapper/lib/apigwRequestWrapper');
const assert = require('assert');
const JSONLDUtils = require('jsonld-utils/lib/jldUtils').npUtils;
const JWTClaims = require('jwt-utils/lib/jwtUtils').claims;
const JWTUtils = require('jwt-utils/lib/jwtUtils').jwtUtils;
const HttpStatus = require('http-status');
const MDUtils = require('metadata/lib/md').utils;
const moment = require('moment');
const PNDataModel = require('data-models/lib/PNDataModel');
const PN_T = PNDataModel.TYPE;
const PN_P = PNDataModel.PROPERTY;
const util = require('util');

const loggingMD = {
    ServiceType: 'pipe-utils',
    FileName: 'pipe-utils/utils.js', };

let promises = {};
let callbacks = {};

/*
 promise to CREATE PRIVACY PIPE

 Accepts a partial pipe, wraps in a metadata JWT and sends it to the privacy broker
 using the APIGW wrapper.

 The parameters are
 * serviceCtx - normal
 * requestId - used for logging only
 * pipe - the partial pipe json-ld node
 * props - can be empty

 The result JWT from the privacy broker is verified, if all ok the following is returned
     { pipe: the pipe, provision: optional provision }

 otherwise a PN Error is returned.

*/

promises.createPrivacyPipe = function promiseCreatePrivacyPipe(serviceCtx, requestId, pipe, props) {
  'use strict';
  return new Promise(function (resolve, reject) {
    callbacks.createPrivacyPipe(serviceCtx, requestId, pipe, props, function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

callbacks.createPrivacyPipe = function createPrivacyPipe(serviceCtx, requestId, pipe, props, callback) {
  'use strict';
  assert(serviceCtx, 'createPrivacyPipe - no serviceCtx param');
  assert(requestId, 'createPrivacyPipe - no requestId param');
  assert(pipe, 'createPrivacyPipe - no pipe param');
  assert(props, 'createPrivacyPipe - no props param');

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'Create-PRIVACY-PIPE',
                          requestId: requestId,
                          pipeId: pipe['@id'],
                          metadata: pipe, }, loggingMD);

  //
  // The privacy broker expects the request as a signed JWT with a metadata claim
  // containing the pipe information.
  //
  let pipeJWT = JWTUtils.signMetadata(pipe, serviceCtx.config.crypto.jwt, { subject: pipe['@id'] });

  //
  // create the props needed by the low level apigwRequestWrapper, note
  // So can use the AWS APIGW do not pass the domainID as part of the path
  //
  let postProps = {
    //domainIdParam: PNDataModel.model.ids.paramUtils.createParamFromDomain(serviceCtx.config.DOMAIN_NAME),
    logger: serviceCtx.logger,
    loggerMsgId: requestId,
    logMsgServiceName: serviceCtx.name,
  };

  apigwRequestWrapper.callbacks.postCreatePrivacyPipeJWT(
                postProps, serviceCtx.config.API_GATEWAY_URL, pipeJWT, function (err, response) {

    if (err) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                            action: 'Create-PRIVACY-PIPE-ERROR-UNEXPECTED-ERROR',
                            domainName: serviceCtx.config.DOMAIN_NAME,
                            requestId: requestId,
                            pipeId: pipe['@id'],
                            err: err, }, loggingMD);
      return callback(err);
    }

    switch (response.statusCode) {
      case HttpStatus.OK: {
        //
        // The privacy broker returns a JWT that contains the pipe and possible
        // provision information. Verify the JWT and extract results to pass back
        //
        if (serviceCtx.config.VERIFY_JWT) {
          try {
            let verified = JWTUtils.newVerify(response.body, serviceCtx.config.crypto.jwt);
            serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                                      action: 'Create-PRIVACY-PIPE-PB-response-JWT-VERIFY-PASSED',
                                      requestId: requestId,
                                      pipeId: pipe['@id'],
                                      metadata: verified, }, loggingMD);
          } catch (err) {
            let error1 = PNDataModel.errors.createInvalidJWTError({
                      id: PNDataModel.ids.createErrorId(serviceCtx.config.getHostname(), moment().unix()),
                      type: PN_T.Metadata, jwtError: err, });

            serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                        action: 'Create-PRIVACY-PIPE-PB-response-ERROR-JWT-VERIFY', inputJWT: response.body,
                                        error: error1,
                                        requestId: requestId,
                                        pipeId: pipe['@id'],
                                        decoded: JWTUtils.decode(response.body,  { complete: true }),
                                        jwtError: err, }, loggingMD);

            return callback(error1, null);
          }
        }

        let payload = JWTUtils.decode(response.body); // decode as may not have verified

        // generate the pipe JSONLD node from the JWT
        let newPipe = MDUtils.JWTPayload2Node(payload, serviceCtx.config.getHostname());
        if (PNDataModel.errors.isError(newPipe)) {
          serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                            action: 'Create-PRIVACY-PIPE-PB-response-ERROR-CANNOT-CONVERT-JWT-to-PIPE',
                            requestId: requestId, pipeId: pipe['@id'],
                            error: newPipe, }, loggingMD);
          return callback(null, newPipe);
        }

        let result = { pipe: newPipe }; // pipe is in metadata claim

        if (payload[JWTClaims.PROVISION_CLAIM]) {
          result.provision = payload[JWTClaims.PROVISION_CLAIM];
        }

        if (result.provision) {
          serviceCtx.logger.logProgress(util.format('REQUEST: %s CREATED PRIVACY PIPE OK: %s - PROVISION RETURNED: %s',
                requestId, result.pipe['@id'], result.provision['@id']));

        } else {
          serviceCtx.logger.logProgress(util.format('REQUEST: %s CREATED PRIVACY PIPE OK: %s - NO PROVISION RETURNED',
                requestId, result.pipe['@id']));
        }

        serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                                  action: 'Create-PRIVACY-PIPE-COMPLETED-OK',
                                  requestId: requestId,
                                  pipeId: pipe['@id'],
                                  metadata: payload, }, loggingMD);

        return callback(null, result);

      } // OK

      case HttpStatus.BAD_REQUEST: {
        // bad request is returned as an application/json
        if (response.headers['content-type'] === 'application/json') {
          let err = JSON.parse(response.body);
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                                    action: 'Create-PRIVACY-PIPE-FAILED-BAD-REQUEST',
                                    requestId: requestId,
                                    pipeId: pipe['@id'],
                                    pipe: pipe,
                                    error: err, }, loggingMD);

          return callback(null, err);

        } else {
          serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                    action: 'CREATE-PRIVACY-PIPE-FAILED-RETURNED-BAD-REQUEST-BUT-CONTENT-HEADER-NOT-APPLICATION/JSON',
                                    requestId: requestId,
                                    pipeId: pipe['@id'],
                                    metadata: pipe,
                                    headers: response.headers, }, loggingMD);

          assert(false, util.format(
            'CREATE-PRIVACY-PIPE-RETURNED-BAD-REQUEST-BUT-CONTENT-HEADER-NOT-APPLICATION/JSON:%j',
            response.headers));

          return callback(null, null); // will not get here
        }

        break;
      } // bad request

      default: {
        serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                action: 'CREATE-PRIVACY-PIPE-FAILED-RETURNED-UNKNOWN-STATUS-CODE',
                                requestId: requestId,
                                pipeId: pipe['@id'],
                                metadata: pipe,
                                statusCode: response.statusCode,
                                headers: response.headers, }, loggingMD);

        assert(false, util.format(
                'CREATE-PRIVACY-PIPE-RETURNED-UNKNOWN-STATUS-CODE:%s', response.statusCode));

        return callback(null, null); // will not get here
      } // default
    } // switch
  }); // post
};

/*
  Post the past in JWT to the passsed in pipe and return the response
  props.msgId
  props.msgAction
*/
promises.postJWT = function promisePostJWT(serviceCtx, pipe, sendJWT, props) {
  'use strict';
  assert(serviceCtx, 'serviceCtx param is missing');
  assert(pipe, 'pipe param is missing');
  assert(sendJWT, 'sendJWT param is missing');
  assert(props, 'props param is missing');
  assert(props.msgId, util.format('props.msgId param is missing'));
  assert(props.msgAction, util.format('props.msgAction param is missing'));

  return new Promise(function (resolve, reject) {
    callbacks.postJWT(serviceCtx, pipe, sendJWT, props, function (err, response) {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
};

callbacks.postJWT = function callbackPostJWT(serviceCtx, pipe, sendJWT, props, callback) {
  'use strict';

  let postURL = JSONLDUtils.getV(pipe, PN_P.postDataUrl);

  apigwRequestWrapper.promises.postJWT(serviceCtx, props.msgId, postURL, sendJWT)
    .then(function (response) {
      switch (response.statusCode) {

        case HttpStatus.OK:
        case HttpStatus.ACCEPTED: {
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                                      action: props.msgAction + '-POST-JWT-2-Pipe-OK',
                                      msgId: props.msgId,
                                      privacyPipe: pipe['@id'],
                                      headers: response.headers,
                                      postURL: postURL, }, loggingMD);

          return callback(null, response);
        }

        case HttpStatus.BAD_REQUEST: {
          let error = response.body;
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                                      action: props.msgAction + '-POST-JWT-2-Pipe-BAD-REQUEST',
                                      msgId: props.msgId,
                                      privacyPipe: pipe['@id'],
                                      headers: response.headers,
                                      error: error,
                                      postURL: postURL, }, loggingMD);

          return callback(error, null);
        }

        case HttpStatus.FORBIDDEN: {
          let error = PNDataModel.errors.createNotFoundError({
              id: PNDataModel.ids.createErrorId(serviceCtx.config.getHostname(), moment().unix()),
              errMsg: util.format('ERROR FORBIDDEN for msg:%s returned when posting data to pipe [%s] see log file',
                                  props.msgId, pipe['@id']),
            });

          serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                      action: props.msgAction + '-POST-JWT-2-Pipe-FORBIDDEN',
                                      msgId: props.msgId,
                                      privacyPipe: pipe['@id'],
                                      headers: response.headers,
                                      error: error,
                                      postURL: postURL, }, loggingMD);
          return callback(error, null);
        }

        case HttpStatus.NOT_FOUND: {
          let error = PNDataModel.errors.createNotFoundError({
              id: PNDataModel.ids.createErrorId(serviceCtx.config.getHostname(), moment().unix()),
              errMsg: util.format('ERROR NOT-FOUND for msg:%s returned when posting data to pipe [%s] see log file',
                          props.msgId, pipe['@id']),
            });

          serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                      action: props.msgAction + '-POST-JWT-2-Pipe-NOT-FOUND',
                                      msgId: props.msgId,
                                      privacyPipe: pipe['@id'],
                                      headers: response.headers,
                                      error: error,
                                      postURL: postURL, }, loggingMD);

          return callback(error, null);
        }

        default:
          assert(false,
            util.format('failed to post to:%s with unknown response.statusCode:%s', postURL, response.statusCode));
      }

    },

    function (err) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                  action: props.msgAction + '-POST-JWT-2-Pipe-ERROR',
                                  msgId: props.msgId,
                                  privacyPipe: pipe['@id'],
                                  error: err,
                                  postURL: postURL, }, loggingMD);
      return callback(err, null);
    })
    .catch(function (reason) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                  action: props.msgAction + '-POST-JWT-2-Pipe-CATCH-ERROR',
                                  msgId: props.msgId,
                                  privacyPipe: pipe['@id'],
                                  error: reason,
                                  postURL: postURL, }, loggingMD);
      return callback(reason, null);
    });
};

module.exports = {
  callbacks: callbacks,
  promises: promises,
};
