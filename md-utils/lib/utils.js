/*jslint node: true, vars: true */

//
// Provides utility routines for accessing and saving metadata using the
// apigwRequestWrapper base level fetch/post metadata. But adds
//  - performs JWt processing
//  - error handling

const apigwRequestWrapper = require('node-utils/apigwRequestWrapper/lib/apigwRequestWrapper');
const assert = require('assert');
const JWTUtils = require('jwt-utils/lib/jwtUtils').jwtUtils;
const HttpStatus = require('http-status');
const moment = require('moment');
const MDUtils = require('metadata/lib/md').utils;
const PNDataModel = require('data-models/lib/PNDataModel');
const PN_T = PNDataModel.TYPE;
const util = require('util');

const loggingMD = {
    ServiceType: 'md-utils',
    FileName: 'md-utils/utils.js', };

var promises = {};
var callbacks = {};

//---------------------
// Fetch metadata
//-------------------

// added as worked on v2 as no idea why needed to pass in the req, and res for
// create pipe, seemed bogus
//
promises.fetchMetadata = function promiseFetchMetadata(serviceCtx, mdId, props) {
  'use strict';
  return new Promise(function (resolve, reject) {
    callbacks.fetchMetadata(serviceCtx, mdId, props, function (err, mdResource) {
      if (err) {
        reject(err);
      } else {
        resolve(mdResource);
      }
    });
  });
};

callbacks.fetchMetadata = function fetchMetadata(serviceCtx, mdId, props, callback) {
  'use strict';

  let mdIdParam = PNDataModel.ids.paramUtils.createMdParamFromMdId(mdId);
  let domainIdParam = PNDataModel.ids.paramUtils.createParamFromDomain(serviceCtx.config.DOMAIN_NAME);

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'Fetch-Metadata',
                          mdId: mdId, mdIdParam: mdIdParam, domainIdParam: domainIdParam,
                        }, loggingMD);

  //
  // So can use the AWS APIGW do not pass the domainID as part of the path
  //
  //fetchProps.domainIdParam = domainIdParam;
  let fetchProps = {};
  fetchProps.mdIdParam = mdIdParam;
  fetchProps.loggerMsgId = mdIdParam;
  fetchProps.logMsgServiceName = serviceCtx.name;
  fetchProps.logMsgPrefix = 'Fetch-Metadata';
  fetchProps.logger = serviceCtx.logger;

  apigwRequestWrapper.callbacks.fetchMetadataJWT(fetchProps, serviceCtx.config.API_GATEWAY_URL, function (err, response) {
    if (err) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                            action: 'Fetch-Metadata-ERROR-UNEXPECTED-ERROR',
                            domainName: serviceCtx.config.DOMAIN_NAME,
                            mdId: mdId,
                            err: err, }, loggingMD);
      return callback(err);
    }

    switch (response.statusCode) {
      case HttpStatus.OK: {
        //
        // if configured to verify then verify
        //
        if (serviceCtx.config.VERIFY_JWT) {
          try {
            let verified = JWTUtils.newVerify(response.body, serviceCtx.config.crypto.jwt);
            serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                                      action: 'Fetch-Metadata-JWT-VERIFY-PASSED',
                                      mdId: mdId,
                                      metadata: verified, }, loggingMD);
          } catch (err) {
            let error1 = PNDataModel.errors.createInvalidJWTError({
                      id: PNDataModel.ids.createErrorId(serviceCtx.config.getHostname(), moment().unix()),
                      type: PN_T.Metadata, jwtError: err, });

            serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                                        action: 'Fetch-Metadata-ERROR-JWT-VERIFY', inputJWT: response.body,
                                        error: error1,
                                        mdId: mdId,
                                        decoded: JWTUtils.decode(response.body,  { complete: true }),
                                        jwtError: err, }, loggingMD);

            return callback(error1, null);
          }
        }

        let payload = JWTUtils.decode(response.body); // decode as may not have verified
        let md = MDUtils.JWTPayload2Node(payload, serviceCtx.config.getHostname());

        if (PNDataModel.errors.isError(md)) {
          serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                            action: 'FETCH-Metadata-Payload-is-Error',
                            mdId: mdId, error: md, }, loggingMD);
          return callback(md, null);

        } else {
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'FETCH-Metadata-OK',
                            mdId: mdId,
                            metadata: md,
                            returnedStatusCode: response.statusCode, returnedHeaders: response.headers, }, loggingMD);
          return callback(null, md);
        }

        break;
      }

      case HttpStatus.NOT_FOUND: {

        if ((response) && (response.body)) {
          // the metadata service can return an error in the body, if one
          // then extract with decode and display
          let decoded = JWTUtils.decode(response.body, serviceCtx.config.crypto.jwt);
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                                action: 'Fetch-Metadata-INFO-NOT-FOUND',
                                domainName: serviceCtx.config.DOMAIN_NAME,
                                mdId: mdId,
                                data: decoded, }, loggingMD);

          // the error is in the graph so extract and return to caller
          let error = JWTUtils.getPnGraph(decoded);
          return callback(error, null);
        } else {
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                                action: 'Fetch-Metadata-INFO-NOT-FOUND-NO-RESPONSE-BODY-CHECK-API-GATEWAY-URL',
                                domainName: serviceCtx.config.DOMAIN_NAME,
                                mdId: mdId, }, loggingMD);

          return callback(util.format('MD:%s NOT FOUND - check API-GATEWAY-URL', mdId), null);
        }

        break;
      }

      default: {
        // unexpected response so for now just cause an exception
        serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                              action: 'Fetch-Metadata-ERROR-UNEXPECTED-STATUS-CODE',
                              domainName: serviceCtx.config.DOMAIN_NAME,
                              mdId: mdId,
                              statusCode: response.statusCode, }, loggingMD);

        assert(false, util.format('Unexpected status fetching one metadata code:%s', response.statusCode));
        return callback(util.format('Unexpected fetching one metadata status code:%s', response.statusCode), null);
      }
    }
  });
};

module.exports = {
  callbacks: callbacks,
  promises: promises,
};
