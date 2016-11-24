/*jslint node: true, vars: true */

const assert = require('assert');
const eItemFactory = require('./eitem');
const JSONLDPromises = require('jsonld-utils/lib/jldUtils').promises;
const JSONLDUtils = require('jsonld-utils/lib/jldUtils').npUtils;
const util = require('util');
const uuid = require('uuid');

const loggingMD = {
        ServiceType: 'connector-utils/pstepi-executor',
        FileName: 'obfuscateUtils.js', };

let promises = {};
let callbacks = {};
let utils = {}; // expsose to support testing

//
// mapData2EncryptItems
//
// Process the input graph looking for fields that need to be encrypted and if
// found create an encrypt item for them, returning an array of encrypt items.
//
// Assumptions
//  1. Input data is an array of subjects
//
// The process in more detail is
// 0. Create a map of subject #id to subject
// 1. Find top level json-schema type property
// 2. If type is not object fail as cannot handle yet
// 3. Find the json-schema title field as this holds the JSON-LD property type
// 4. For each subject of the json-ld type perform the following - jsonld.frame() return ids of the type not copies
// 4.1 For each json-schema property that is in the subject perform the following
// 4.1.1 If type is @id or @type skip
// 4.1.2 If type is not object create an eitem for the fields and add to set of Eitems
// 4.1.3 If type is an object, callback on self passed in node and schema
// 4.2. Return array of encryption items
//
// An Encrypt Item has the following fields
//  - id - an id that is unique within scope of this execution and the obfuscation request
//  - type - set to the passed in value - the encrypt metadata passed to the service
//  - v - the value to encrypt
//  - n - for now set to null, may be returned by caller
//  - aad - for now set to null - can set to the @id the subject - code just knows to do this
//
// The @context is
//  - id: @id
//  - type: @type
//  - v: pn_p.v
//  - n: pn_p.n
//  - aad: pn_p.aad
//
// Returns the following
//  - array of encrypt item
//  - map < encrypt_item_id, { id: <object id>, key: <property name } || { id: <object id>, embedKey: <embed key name>, key: <prop name>}>
//
promises.mapData2EncryptItems = function mapData2EncryptItems(serviceCtx, graph, schema, type, props) {
  'use strict';
  return new Promise(function (resolve, reject) {
    callbacks.mapData2EncryptItems(serviceCtx, graph, schema, type, props, function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

callbacks.mapData2EncryptItems = function mapData2EncryptItems(serviceCtx, graph, schema, type, props, callback) {
  'use strict';
  assert(serviceCtx, 'mapData2EncryptItems - serviceCtx param missing');
  assert(graph, 'mapData2EncryptItems - data param missing');
  assert(schema, 'mapData2EncryptItems - schema param missing');
  assert(type, 'mapData2EncryptItems - type param missing');
  assert(props, 'mapData2EncryptItems - props param missing');
  assert(props.msgId, 'mapData2EncryptItems - props.msgId param missing');

  assert(schema.type, util.format('No type in json schema:%j', schema));
  assert(schema.title, util.format('No title in json schema:%j', schema));
  assert(schema.properties, util.format('No properties in json schema:%j', schema));

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'mapData2EncryptItems-Looking-4-Subjects',
            msgId: props.msgId, type: schema.title, data: graph, }, loggingMD);

  let result = {};
  result.eitems = [];

  //
  // Create a map of @id to subjects - first map to an array as easier to process
  //
  let t;
  if (graph['@graph']) {
    t = graph['@graph'];
  } else if (Array.isArray(graph)) {
    t = graph;
  } else {
    t = [graph];
  }

  let id2ObjectMap = new Map();
  for (let i = 0; i < t.length; i++) {
    id2ObjectMap.set(t[i]['@id'], t[i]);
  }

  //
  // Find nodes of type schema.title in the graph
  //
  JSONLDPromises.frame(graph, schema.title, false)
  .then(function (result) {
    let subjects;

    // convert so always processing an array
    if (result['@graph']) {
      subjects = result['@graph'];
    } else {
      subjects = [result];
    }

    serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'mapData2EncryptItems-Found-Subjects',
              msgId: props.msgId, type: schema.title, data: subjects, }, loggingMD);

    //
    // For each matched subject, find the object by its @id in the id2ObjectMap and pass
    // to routine to see if any fields need encrypting
    //
    for (let i = 0; i < subjects[i]; i++) {
      let object = id2ObjectMap.get(subjects[i]['@id']);
      result.eitems = result.eitems.concat(
        utils.processOneSubjectMapDataToEncryptItems(serviceCtx, object, schema, type, {}));
    }

    return callback(null, result);
  });

};

/*
"properties": {
  "@id":        { "type": "string" },
  "@type":      { "type": "array" },
  "https://schema.org/deathDate":                  { "type": "string" },
  "https://schema.org/birthDate":                 { "type": "string" },
  "https://schema.org/email":                     { "type": "string" },
  "https://schema.org/telephone":                 { "type": "string" },
  "https://schema.org/gender":                    { "type": "string" },
  "https://schema.org/givenName":                 { "type": "string" },
  "https://schema.org/familyName":                { "type": "string" },
  "https://schema.org/additionalName":            { "type": "string" },
  "https://schema.org/taxID":                     { "type": "string" },
  "http://pn.schema.webshield.io/prop#taxID":     { "type": "string" },
  "http://pn.schema.webshield.io/prop#sourceID":  { "type": "string" },
  "http://schema.org/address": { "$ref": "#/definitions/https://schema.org/PostalAddress" }
},

*/
utils.processOneSubjectMapDataToEncryptItems = function processOneSubjectMapDataToEncryptItems(serviceCtx, object, schema, type, props) {
  'use strict';
  assert(serviceCtx, 'processOneSubjectMapDataToEncryptItems - serviceCtx param missing');
  assert(object, 'processOneSubjectMapDataToEncryptItems - object param missing');
  assert(schema, 'processOneSubjectMapDataToEncryptItems - schema param missing');
  assert(type, 'processOneSubjectMapDataToEncryptItems- type param missing');
  assert(props, 'processOneSubjectMapDataToEncryptItems - props param missing');
  assert(props.msgId, 'processOneSubjectMapDataToEncryptItems- props.msgId param missing');

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
            action: 'processOneSubjectMapDataToEncryptItems-Create-EITEMS-Start',
            msgId: props.msgId, subject: object['@id'], schemaTitle: schema.title, }, loggingMD);

  let keys = Object.keys(schema.properties);
  let eitems = [];

  for (let i = 0; i < keys.length; i++) {

    let key = keys[i];
    let keyDesc = schema.properties[key];

    switch (key) {

      case '@id':
      case '@type': {
        //skip as for now do not obuscate these
        break;
      }

      default: {
        // ob

        if (keyDesc.type) {

          switch (keyDesc.type) {

            case 'object': {
              assert(false, 'processOneSubjectMapDataToEncryptItems - does not support object');
              break;
            }

            case 'array': {
              assert(false, 'processOneSubjectMapDataToEncryptItems - does not support array');
              break;
            }

            default: {
              // a scalar value field, if field is in the object then create
              // an encrypt item for it and record
              //
              if (object[key]) {
                serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name,
                          action: 'processOneSubjectMapDataToEncryptItems-Create-EITEM',
                          msgId: props.msgId, subject: object['@id'], key: key, keyDesc: keyDesc, }, loggingMD);

                let eitem = eItemFactory.create(uuid(), type, JSONLDUtils.getV(object, key));
                eitems.push(eitem);
              }
            }
          } // switch key.type
        } else if (keyDesc.$ref) { // no key.type
          // process object with a ref to a schema, basically get info and recurse

          let t = keyDesc.$ref;
          let k = t.replace('#/definitions/', '');
          let newSchema = schema.definitions[k];
          eitems = eitems.concat(utils.processOneSubjectMapDataToEncryptItems(
                          serviceCtx, object[key], newSchema, type, props));

          //assert(false, 'processOneSubjectMapDataToEncryptItems - does not support $ref');
        } else {
          assert(false, util.format(
            'processOneSubjectMapDataToEncryptItems - Do not know how to process key:%s with desc: %j in schema to create eitems:%j',
                      key, keyDesc, schema));
        }
      }
    }
  } // for

  return eitems;
};

module.exports = {
  callbacks: callbacks,
  promises: promises,
  utils: utils,
};
