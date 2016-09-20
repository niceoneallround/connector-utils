/*jslint node: true, vars: true */

const apigwRequestWrapper = require('node-utils/apigwRequestWrapper/lib/apigwRequestWrapper');
const async = require('async');
const assert = require('assert');
const fs = require('fs');
const JWTUtils = require('jwt-utils/lib/jwtUtils').jwtUtils;
const HttpStatus = require('http-status');
const MDUtils = require('metadata/lib/md').utils;
const PNDataModel = require('data-models/lib/PNDataModel');
const PNDataModelError = PNDataModel.model.errors;
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

  let md;

  loggingMD.ServiceType = serviceCtx.name; // setup logging

  // Read the metadata YAML file and convert to JSON
  try {
    md = yaml.safeLoad(readFile(serviceCtx.config.METADATA_FILE));
    serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'From-File-CreateMD-Read-Metadata-File',
                            filename: serviceCtx.config.METADATA_FILE,
                            metadata: md, }, loggingMD);

  } catch (e) {
    serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name, action: 'From-File-CreateMD-Read-Metadata-File-ERROR',
                            filename: serviceCtx.config.METADATA_FILE,
                            error: e, }, loggingMD);
    return callback(e);
  }

  createDomain(serviceCtx, md.domain, function (err, domain) {
    if (err) {
      return callback(err);
    }

    // start with domain as the set of results
    let results = [];
    if (domain) {
      results.push(domain);
    }

    // create resources
    createResources(serviceCtx, md.resources, function (err, resources) {
      results = results.concat(resources);
      return callback(null, results);
    });
  });
}

//------------------
// Create a Domain Object
//------------------
function createDomain(serviceCtx, domain, callback) {
  'use strict';
  assert(serviceCtx, 'serviceCtx param is missing');
  assert(callback, 'callback param is missing');

  if (!domain) {
    serviceCtx.logger.logJSON('warn', { serviceType: serviceCtx.name,
                      action: 'From-File-CreateMD-Read-Metadata-File-NO-DOMAIN-node-will-CONTINUE', }, loggingMD);
    return callback(null, null);
  }

  assert(domain.name, util.format('domain.name is missing: %j', domain));
  assert(domain.data_model_id, util.format('domain.data_model_id is missing: %j', domain));

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'BootupMD-Create-Domain',
                          domain: domain, }, loggingMD);

  let domainId = PNDataModel.ids.paramUtils.createParamFromDomain(domain.name);

  //
  // First fetch to see if already created if so then no work
  //
  let fetchProps = {};
  fetchProps.domainIdParam = domainId;
  fetchProps.loggerMsgId = domainId; // just use the domainId
  fetchProps.logMsgServiceName = serviceCtx.name;
  fetchProps.logMsgPrefix = 'From-File-Create-Domain-Check-If-Exists';
  fetchProps.logger = serviceCtx.logger;

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'From-File-Create-Domain-Check-if-Exists',
                          name: domain.name,
                          domainId: domainId, }, loggingMD);

  apigwRequestWrapper.callbacks.fetchDomainJWT(fetchProps, serviceCtx.config.API_GATEWAY_URL, function (err, response) {
    if (err) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name,
                              action: 'From-File-Create-Domain-ERROR',
                              name: domain.name,
                              domainId: domainId,
                              error: err, }, loggingMD);
      return callback(err);
    }

    switch (response.statusCode) {
      case HttpStatus.OK:
        let verified = JWTUtils.newVerify(response.body, serviceCtx.config.crypto.jwt);
        let fetchedDomain = JWTUtils.getPnGraph(verified);

        if (PNDataModelError.isError(fetchedDomain)) {
          serviceCtx.logger.logJSON('error', {
                      serviceType: serviceCtx.name,
                      action: 'From-File-Create-Domain-Check-Exists-Returned-Error',
                      name: domain.name,
                      error: fetchedDomain, }, loggingMD);
          return callback(fetchedDomain, null);
        } else {
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'From-File-Create-Domain-FOUND-Domain',
                                  name: domain.name,
                                  metadata: fetchedDomain, }, loggingMD);

          return callback(null, fetchedDomain);
        }

        break;
      case HttpStatus.NOT_FOUND:
        serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                              action: 'From-File-Create-Domain-DID-NOT-FIND-Domain',
                              domainId: domainId,
                              name: domain.name, }, loggingMD);
        break;

      default:
        assert(false, util.format('Unexpected status fetching Domain code:%s', response.statusCode));
        return callback(util.format('Unexpected fetching Domain status code:%s', response.statusCode), null);
    }

    //
    // if got to here the Domain NEEDS TO BE CREATED
    //
    let domainReq = PNDataModel.model.utils.createDomainRequest({ name: domain.name, datamodel: domain.data_model_id });
    serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'From-File-Create-Domain-need-2-CREATE-Start',
                            domainId: domainId,
                            name: domain.name,
                            domainRequest: domainReq, }, loggingMD);

    let domainReqJWT = JWTUtils.signData(domainReq, serviceCtx.config.crypto.jwt, { subject: domainReq['@id'] });
    let postProps = {};
    postProps.loggerMsgId = domainId; // just use the domainId
    postProps.logMsgServiceName = serviceCtx.name;
    postProps.logMsgPrefix = 'From-File-Create-Domain';
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
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'From-File-Create-Domain-CREATE-SUCCESS',
                                  metadata: newDomainR, }, loggingMD);

          return callback(null, newDomainR); // ALL OK :)
        case HttpStatus.BAD_REQUEST:
          verified = JWTUtils.newVerify(response.body, serviceCtx.config.crypto.jwt);
          let error = JWTUtils.getPnGraph(verified);
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                                  action: 'From-File-Create-Domain-BAD-REQUEST',
                                  domainReq: domainReq,
                                  error: error, }, loggingMD);
          return callback(error, null);
        default:
          assert(false, util.format('create domain Unexpected status code:%s', response.statusCode));
          return callback(util.format('create domain Unexpected status code:%s', response.statusCode), null);
      } // switch
    });
  }); // fetch
}

//------------------------
// Create Resources
//-----------------------
function createResources(serviceCtx, resources, callback) {
  'use strict';
  assert(serviceCtx, 'serviceCtx param is missing');
  assert(callback, 'callback param is missing');

  let results = [];

  if (!resources) {
    serviceCtx.logger.logJSON('warn', { serviceType: serviceCtx.name,
                      action: 'From-File-CreateMD-Read-Metadata-File-NO-RESOURCE-nodes-will-CONTINUE', }, loggingMD);
    return callback(null, results);
  }

  console.log(JSON.stringify(resources, null, 2));

  let processOne = function (item, nextCB) {
    createOneMetadata(serviceCtx, item, function (err, md) {
      if (err) {
        return nextCB(err);
      } else {
        results.push(md);
        return nextCB(null);
      }
    });
  };

  async.eachSeries(resources, processOne, function (err) {
    if (err) {
      return callback(err);
    } else {
      return callback(null, results);
    }
  });
}

//
// For the passed in md see if already created, if not then create
//
function createOneMetadata(serviceCtx, md, callback) {
  'use strict';
  assert(serviceCtx, 'serviceCtx param is missing');
  assert(md, 'md param is missing');
  assert(callback, 'callback param is missing');

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'From-File-Create-One-Metadata',
                          domainName: serviceCtx.config.DOMAIN_NAME,
                          metadata: md, }, loggingMD);

  // FIXME add code to determine type and create the ID
  assert(md.id, util.format('Metadata does not have an id:%j', md));
  let mdId = PNDataModel.ids.createPrivacyAlgorithmId(serviceCtx.config.DOMAIN_NAME, md.id);

  //
  // First fetch to see if already created, if so then no work
  //
  let mdIdParam = PNDataModel.ids.paramUtils.createMdParamFromMdId(mdId);
  let domainIdParam = PNDataModel.ids.paramUtils.createParamFromDomain(serviceCtx.config.DOMAIN_NAME);

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'From-File-Create-One-Metadata-generated-IDs',
                          domainName: serviceCtx.config.DOMAIN_NAME,
                          mdId: mdId, mdIdParam: mdIdParam, domainIdParam: domainIdParam,
                        }, loggingMD);

  // fetch to see if there if so do not create
  let fetchProps = {};

  //
  // So can use the AWS APIGW do not pass the domainID as part of the path
  //
  //
  //fetchProps.domainIdParam = domainIdParam;

  fetchProps.mdIdParam = mdIdParam;
  fetchProps.loggerMsgId = mdIdParam;
  fetchProps.logMsgServiceName = serviceCtx.name;
  fetchProps.logMsgPrefix = 'From-File-Create-One-Metadata-Check-Exists';
  fetchProps.logger = serviceCtx.logger;

  apigwRequestWrapper.callbacks.fetchMetadataJWT(fetchProps, serviceCtx.config.API_GATEWAY_URL, function (err, response) {
    if (err) {
      return callback(err);
    }

    switch (response.statusCode) {
      case HttpStatus.OK:
        let verified = JWTUtils.newVerify(response.body, serviceCtx.config.crypto.jwt);
        let fetchedMd = JWTUtils.getPnGraph(verified);

        if (PNDataModelError.isError(fetchedMd)) {
          serviceCtx.logger.logJSON('error', {
                      serviceType: serviceCtx.name,
                      action: 'From-File-Create-One-Metadata-Check-Exists-Returned-Error',
                      domainName: serviceCtx.config.DOMAIN_NAME,
                      error: fetchedMd, }, loggingMD);
          return callback(fetchedMd, null);
        } else {
          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'From-File-Create-One-Metadata-FOUND',
                                  domainName: serviceCtx.config.DOMAIN_NAME,
                                  metadata: fetchedMd, }, loggingMD);

          return callback(null, fetchedMd);
        }

        break;
      case HttpStatus.NOT_FOUND:
        serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                              action: 'From-File-Create-One-Metadata-DID-NOT-FIND-Metadata',
                              domainName: serviceCtx.config.DOMAIN_NAME,
                              mdId: mdId, }, loggingMD);
        break;

      default:
        assert(false, util.format('Unexpected status fetching one metadata code:%s', response.statusCode));
        return callback(util.format('Unexpected fetching one metadata status code:%s', response.statusCode), null);
    }

    //
    // NEED TO CREATE METADATA AS DOES NOT EXIST
    //

    let mdNode = MDUtils.YAML2Metadata(md, { hostname: serviceCtx.config.DOMAIN_NAME }); // ok to use domain

    serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                          action: 'From-File-Create-One-Metadata-Created-JSON-LD-Node',
                          domainName: serviceCtx.config.DOMAIN_NAME,
                          mdId: mdId,
                          metadata: mdNode, }, loggingMD);

    // for sanity make sure that the id looked for is the same as created
    assert((mdId === mdNode['@id']), util.format('The fetched id is not the same as the created\n f:%s\nc:%s',
                      mdId, mdNode['@id']));

    let mdJWT = JWTUtils.signMetadata(mdNode, serviceCtx.config.crypto.jwt, { subject: mdNode['@id'] });

    //
    // So can use the AWS APIGW do not pass the domainID as part of the path
    //
    //
    //postProps.domainIdParam = domainIdParam;
    let postProps = {};
    postProps.loggerMsgId =  mdIdParam; // just use the domainId
    postProps.logMsgServiceName = serviceCtx.name;
    postProps.logMsgPrefix = 'Bootup-Create-Metadata';
    postProps.logger = serviceCtx.logger;

    apigwRequestWrapper.callbacks.postMetadataJWT(postProps, serviceCtx.config.API_GATEWAY_URL, mdJWT, function (err, response) {
      if (err) {
        return callback(err);
      }

      let verified;
      switch (response.statusCode) {
        case HttpStatus.OK:
          verified = JWTUtils.newVerify(response.body, serviceCtx.config.crypto.jwt);
          let createdMd = JWTUtils.getPnGraph(verified);

          serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'From-File-Create-One-Metadata-SUCCESS',
                                  domainName: serviceCtx.config.DOMAIN_NAME,
                                  metadata: createdMd, }, loggingMD);

          return callback(null, createdMd);
        case HttpStatus.BAD_REQUEST:
          verified = JWTUtils.newVerify(response.body, serviceCtx.config.crypto.jwt);
          let error = JWTUtils.getPnGraph(verified);

          serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name, action: 'From-File-Create-One-Metadata-BAD-REQUEST',
                                  domainName: serviceCtx.config.DOMAIN_NAME,
                                  mdNode: mdNode,
                                  error: error, }, loggingMD);
          return callback(error, null);
        default:
          assert(false, util.format('Unexpected status code:%s', response.statusCode));
          return callback(false,  util.format('Unexpected status code:%s', response.statusCode));
      }
    }); // post
  }); // fetch
}

module.exports = {
  execute: execute,
};
