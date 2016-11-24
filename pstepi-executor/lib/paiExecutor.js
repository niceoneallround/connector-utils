/*jslint node: true, vars: true */

const assert = require('assert');
const JSONLDUtils = require('jsonld-utils/lib/jldUtils').npUtils;
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

  //
  // Uses the privacy action instance JSON schema to process the graph looking
  // for subjects and properties that needed to be obfuscated and creating the
  // items that can be sent to the obfuscation service
  //

  let schema = JSONLDUtils.getO(props.pai, PN_P.schema);
  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'PAI-Executor-Using-JSON-Schema-on-Data',
                                      pai: props.pai['@id'],
                                      metadata: schema, }, loggingMD);

  let data;
  if (props.graph['@graph']) {
    data = props.graph['@graph'];
  } else {
    data = [data];
  }

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'PAI-Executor-Using-Data',
                                      pai: props.pai['@id'],
                                      data: data, }, loggingMD);

  return callback(null, null);
};

module.exports = {
  callbacks: callbacks,
  promises: promises,
};
