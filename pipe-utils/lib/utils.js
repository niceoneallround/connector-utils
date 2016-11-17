/*jslint node: true, vars: true */

/*

Provides utility routines to create a privacy pipe using the apigwRequestWrapper
adding error handling.

*/

const apigwRequestWrapper = require('node-utils/apigwRequestWrapper/lib/apigwRequestWrapper');
const assert = require('assert');
const JWTClaims = require('jwt-utils/lib/jwtUtils').claims;
const JWTUtils = require('jwt-utils/lib/jwtUtils').jwtUtils;
const HttpStatus = require('http-status');
const moment = require('moment');
const PNDataModel = require('data-models/lib/PNDataModel');
const PN_T = PNDataModel.TYPE;
const util = require('util');

const loggingMD = {
    ServiceType: 'pipe-utils',
    FileName: 'pipe-utils/utils.js', };

var promises = {};
var callbacks = {};

/*
 CREATE PRIVACY PIPE

 Accepts a partial pipe, wraps in a metadata JWT and sends it to the privacy broker
 using the APIGW wrapper.

 The result JWT is verified and if all ok a JSON object containing the pipe and optional provision
 is returned, otherwise a PN Error is returned.

 The parameters are
 * serviceCtx - normal
 * requestId - used for logging only
 * pipe - the partial pipe json-ld node
 * props - can be empty
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

        let result = { pipe: payload[JWTClaims.METADATA_CLAIM] }; // pipe is in metadata claim

        if (payload[JWTClaims.PROVISION_CLAIM]) {
          result.provision = payload[JWTClaims.PROVISION_CLAIM];
        }

        if (result.provision) {
          serviceCtx.logger.logProgress(util.format('SYNDICATION REQUEST: %s CREATED PRIVACY PIPE: %s - PROVISION RETURNED: %s',
                requestId, result.pipe['@id'], result.provision['@id']));

        } else {
          serviceCtx.logger.logProgress(util.format('SYNDICATION REQUEST: %s CREATED PRIVACY PIPE: %s - NO PROVISION RETURNED',
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
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                                    action: 'Create-PRIVACY-PIPE-FAILED-BAD-REQUEST',
                                    requestId: requestId,
                                    pipeId: pipe['@id'],
                                    metadata: pipe,
                                    error: response.body, }, loggingMD);

          return callback(null, JSON.parse(response.body));

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

module.exports = {
  callbacks: callbacks,
  promises: promises,
};
