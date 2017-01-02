/*jslint node: true, vars: true */

const assert = require('assert');
const JSONLDUtils = require('jsonld-utils/lib/jldUtils').npUtils;
const eitemUtils = require('./eitemUtils');
const PNDataModel = require('data-models/lib/PNDataModel');
const PN_P = PNDataModel.PROPERTY;
const v2Encrypt = require('./osw/v2Encrypt');

const loggingMD = {
        ServiceType: 'connector-utils/pstepi-executor',
        FileName: 'paiExecutor.js', };

let promises = {};
let callbacks = {};

/*

If an obfuscate operation then returns an array of privacy graphs, one for each source graph passed in
see step executor for explaination

*/

// props.graph - can be either a { @graph: []}, or a single object {}
promises.execute = function promiseExecute(serviceCtx, props) {
  'use strict';
  return new Promise(function (resolve, reject) {
    callbacks.execute(serviceCtx, props, function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

callbacks.execute = function execute(serviceCtx, props, callback) {
  'use strict';
  assert(serviceCtx, 'pactioni-execute: serviceCtx param is missing');
  assert(props, 'pactioni-execute: props param is missing');
  assert(props.graph, 'pactioni-execute: props.graph missing');
  assert(props.pai, 'pactioni-execute: props.pai privacy action instance missing');
  assert(props.msgId, 'pactioni-execute: props.msgId missing');

  let rCtx = {};

  //
  // Uses the privacy action instance JSON schema to process the graph looking
  // for subjects and properties that needed to be obfuscated and creating the
  // items that can be sent to the obfuscation service
  //

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'PAI-Executor-Execute-Using-Privacy-Action-Instance',
                                      msgId: props.msgId,
                                      pai: props.pai['@id'],
                                      metadata: props.pai, }, loggingMD);

  let data;
  if (props.graph['@graph']) {
    data = props.graph['@graph'];
  } else {
    data = [data];
  }

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'PAI-Executor-Execute-Using-Data',
                                      msgId: props.msgId,
                                      pai: props.pai['@id'],
                                      data: data, }, loggingMD);

  // get the schema to procss, note the schema is stored as a string otherwise
  // jsonld process of the node would remove items as not json-ld compliant.
  let schemaS = JSONLDUtils.getO(props.pai, PN_P.schema);
  let schema;

  if (typeof schemaS === 'string') {
    try {
      schema = JSON.parse(schemaS);
    } catch (err) {
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name, action: 'PAI-Executor-Execute-ERROR-Parsing-Schema-From-String',
                                          msgId: props.msgId,
                                          pai: props.pai['@id'],
                                          schema: schemaS,
                                          errror: err, }, loggingMD);
      throw err;
    }
  } else {
    schema = schemaS;
  }

  //
  // Create the set of eitems that need to be passed to the obfuscation service
  //
  let promiseItems2Obfuscate = eitemUtils.promises.mapData2EncryptItems(serviceCtx, data, schema, props.pai, props);

  // obfuscate the items
  let promiseObfuscatedItems = promiseItems2Obfuscate
    .then(function (makeItemsResult) {

      rCtx.makeItemsResult = makeItemsResult;

      //
      // call the obfuscation service -
      // for now hardcoded to call v2 and pass none of required params only so ca get up and runnung
      //
      return v2Encrypt.execute(serviceCtx, rCtx.makeItemsResult.eitems, props);
    });

  let promisePrivacyGraphs = promiseObfuscatedItems
    .then(function (encryptedOitems) {
      //
      // create the privacy graphs based on the results from the obfuscation service
      // note these only contain nodes that should be obfuscated
      //
      return eitemUtils.promises.createNodesBasedOnEitemMap(
                serviceCtx, encryptedOitems['@graph'],
                rCtx.makeItemsResult.eitemsMap, data, props.pai, props);
    });

  // return the privacy graphs
  promisePrivacyGraphs
    .then(function (privacyGraphs) {

      return callback(null, { '@graph': privacyGraphs.privacyGraphs });

    })
    .catch(function (err) {

      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name, action: 'PAI-Executor-Execute-ERROR',
                                          msgId: props.msgId,
                                          pai: props.pai['@id'],
                                          error: err, }, loggingMD);

      throw err;

    });
};

module.exports = {
  callbacks: callbacks,
  promises: promises,
};
