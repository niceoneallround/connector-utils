/*jslint node: true, vars: true */

const apigwRequestWrapper = require('node-utils/apigwRequestWrapper/lib/apigwRequestWrapper');
const assert = require('assert');
const fs = require('fs');
const JWTUtils = require('jwt-utils/lib/jwtUtils').jwtUtils;
const HttpStatus = require('http-status');
const PNDataModel = require('data-models/lib/PNDataModel');
const util = require('util');
const yaml = require('js-yaml');

var loggingMD = {
    ServiceType: 'connector-utils',
    FileName: 'bootupMD.js', };

function readFile(mdFile) {
  'use strict';
  return fs.readFileSync(mdFile, 'utf8');
}

function execute(serviceCtx, props, callback) {
  'use strict';
  assert(serviceCtx, 'serviceCtx param is missing');
  assert(props, 'props param is missing');
  assert(callback, 'callback param is missing');
  assert(serviceCtx.config.METADATA_FILE, util.format('serviceCtx.config.METADATA_FILE is missing from:%j', serviceCtx.config));
  assert(serviceCtx.config.API_GATEWAY_URL, util.format('serviceCtx.config.API_GATEWAY_URL is missing from config:%j', serviceCtx.config));

  let md, results = [];

  loggingMD.ServiceType = serviceCtx.name; // setup logging

  // Read the metadata YAML file and convert to JSON
  try {
    md = yaml.safeLoad(readFile(serviceCtx.config.METADATA_FILE));
    serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'Bootup-CreateMD-Read-Metadata-File',
                            filename: serviceCtx.config.METADATA_FILE,
                            metadata: md, }, loggingMD);

  } catch (e) {
    serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name, action: 'Bootup-CreateMD-Read-Metadata-File-ERROR',
                            filename: serviceCtx.config.METADATA_FILE,
                            error: e, }, loggingMD);
    return callback(e);
  }

  createAccount(serviceCtx, md.account, function (err, account) {
    if (err) {
      return callback(err);
    }

    // add account to set of md created
    results.push(account);
    return callback(null, results);
  });
}

//
// Create an Account Object - this is actually a PN Domain
//
function createAccount(serviceCtx, account, callback) {
  'use strict';
  assert(serviceCtx, 'serviceCtx param is missing');
  assert(callback, 'callback param is missing');

  if (!account) {
    serviceCtx.logger.logJSON('warn', { serviceType: serviceCtx.name,
                      action: 'Bootup-CreateMD-Read-Metadata-File-NO-ACCOUNT-node-will-CONTINUE', }, loggingMD);
    return callback(null, []);
  }

  assert(account.name, util.format('Account.name is missing: %j', account));
  assert(account.data_model_id, util.format('Account.data_model_id is missing: %j', account));

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'BootupMD-Create-ACCOUNT(PNDomain)',
                          account: account, }, loggingMD);

  let domainId = PNDataModel.ids.paramUtils.createParamFromDomain(account.name);

  //
  // First fetch to see if already created if so then no work
  //
  let fetchProps = {};
  fetchProps.domainIdParam = domainId;
  fetchProps.loggerMsgId = domainId; // just use the domainId
  fetchProps.logMsgServiceName = serviceCtx.name;
  fetchProps.logMsgPrefix = 'Bootup-Create-Experian-Domain-Check-If-Domain-Exists';
  fetchProps.logger = serviceCtx.logger;

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'BootupMD-Create-ACCOUNT-Check-if-Exists',
                          name: account.name,
                          accountId: domainId, }, loggingMD);

  apigwRequestWrapper.callbacks.fetchDomainJWT(fetchProps, serviceCtx.config.API_GATEWAY_URL, function (err, response) {
    if (err) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                              action: 'BootupMD-Create-Account-ERROR',
                              name: account.name,
                              accountId: domainId,
                              error: err, }, loggingMD);
      return callback(err);
    }

    switch (response.statusCode) {
      case HttpStatus.OK:
        let verified = JWTUtils.newVerify(response.body, serviceCtx.config.crypto.jwt);
        let fetchedDomain = JWTUtils.getPnGraph(verified);

        if (fetchedDomain instanceof Error) {
          serviceCtx.logger.logJSON('error', {
                      serviceType: serviceCtx.name,
                      action: 'BootupMD-Create-Account-Check-Exists-Returned-Error',
                      name: account.name,
                      error: fetchedDomain, }, loggingMD);
          return callback(fetchedDomain, null);
        } else {
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'BootupMD-Create-account-FOUND-ACCOUNT(pndomain)',
                                  name: account.name,
                                  metadata: fetchedDomain, }, loggingMD);

          return callback(null, fetchedDomain);
        }

        break;
      case HttpStatus.NOT_FOUND:
        serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                              action: 'BootupMD-Create-account-DID-NOT-FIND-ACCOUNT(pndomain)',
                              name: account.name, }, loggingMD);
        break;

      default:
        assert(false, util.format('Unexpected status fetching account (PNDomain) code:%s', response.statusCode));
        return callback(util.format('Unexpected fetching account (PNDomain) status code:%s', response.statusCode), null);
    }

    //
    // if got to here the account (PNDomain) NEEDS TO BE CREATED
    //
    let domainReq = PNDataModel.model.utils.createDomainRequest({ name: account.name, datamodel: account.data_model_id });
    serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'BootupMD-Create-Account-need-2-CREATE-ACCOUNT-Start',
                            accountId: domainId,
                            account: account.name,
                            domainRequest: domainReq, }, loggingMD);

    let domainReqJWT = JWTUtils.signData(domainReq, serviceCtx.config.crypto.jwt, { subject: domainReq['@id'] });
    let postProps = {};
    postProps.loggerMsgId = domainId; // just use the domainId
    postProps.logMsgServiceName = serviceCtx.name;
    postProps.logMsgPrefix = 'Bootup-Create-Account';
    postProps.logger = serviceCtx.logger;

    apigwRequestWrapper.callbacks.createDomainJWT(postProps, serviceCtx.config.API_GATEWAY_URL, domainReqJWT, function (err, response) {
      if (err) {
        return callback(err);
      }

      let verified;
      switch (response.statusCode) {
        case HttpStatus.OK:
          verified = JWTUtils.newVerify(response.body, serviceCtx.config.crypto.jwt);
          let newDomainR = JWTUtils.getPnGraph(verified);
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'BootupMD-Create-Account-CREATE-SUCCESS',
                                  account: account.name,
                                  accountId: domainId,
                                  metadata: newDomainR, }, loggingMD);

          return callback(null, newDomainR); // ALL OK :)
        case HttpStatus.BAD_REQUEST:
          verified = JWTUtils.newVerify(response.body, serviceCtx.config.crypto.jwt);
          let error = JWTUtils.getPnGraph(verified);
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                                  action: 'BootupMD-Create-Account-BAD-REQUEST',
                                  account: account.name,
                                  accountId: domainId,
                                  domainReq: domainReq,
                                  error: error, }, loggingMD);
          return callback(error, null);
        default:
          assert(false, util.format('create account Unexpected status code:%s', response.statusCode));
          return callback(util.format('create account Unexpected status code:%s', response.statusCode), null);
      } // switch
    });
  }); // fetch
}

module.exports = {
  execute: execute,
};
