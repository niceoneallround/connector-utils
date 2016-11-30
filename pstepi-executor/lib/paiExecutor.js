/*jslint node: true, vars: true */

const assert = require('assert');
const JSONLDUtils = require('jsonld-utils/lib/jldUtils').npUtils;
const obfuscateUtils = require('./obfuscateUtils');
const PNDataModel = require('data-models/lib/PNDataModel');
const PN_P = PNDataModel.PROPERTY;

const loggingMD = {
        ServiceType: 'connector-utils/pstepi-executor',
        FileName: 'paiExecutor.js', };

let promises = {};
let callbacks = {};

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
  assert(serviceCtx, 'paction-execute: serviceCtx param is missing');
  assert(props, 'paction-execute: props param is missing');
  assert(props.graph, 'paction-execute: props.graph missing');
  assert(props.pai, 'paction-execute: props.pai privacy action instance missing');
  assert(props.msgId, 'paction-execute: props.msgId missing');

  //
  // Uses the privacy action instance JSON schema to process the graph looking
  // for subjects and properties that needed to be obfuscated and creating the
  // items that can be sent to the obfuscation service
  //

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'PAI-Executor-Using-Privacy-Action-Instance',
                                      msgId: props.msgId,
                                      pai: props.pai['@id'],
                                      metadata: props.pai, }, loggingMD);

  let data;
  if (props.graph['@graph']) {
    data = props.graph['@graph'];
  } else {
    data = [data];
  }

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'PAI-Executor-Using-Data',
                                      msgId: props.msgId,
                                      pai: props.pai['@id'],
                                      data: data, }, loggingMD);

  //
  // Process the input data to generate the set of eitems that will need to be
  // passed to the obfuscation service. Note for now always encryption hence eitems
  //
  let schema = JSONLDUtils.getO(props.pai, PN_P.schema);

  //
  // Create the set of eitems that need to be passed to the obfuscation service
  //
  return obfuscateUtils.promises.mapData2EncryptItems(serviceCtx, data, schema, props.pai, props)
    .then(function (result) {
      console.log(result);

      //
      // call the obfuscation service
      //

      //
      // create the privacy graphs based on the results from the obfuscation service
      // note these only contain nodes that should be obfuscated
      //

      //
      // return the privacy graphs
      //
      return callback(null, null);
    });
};

module.exports = {
  callbacks: callbacks,
  promises: promises,
};
