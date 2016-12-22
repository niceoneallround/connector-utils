/*

Returns a promise for the result of calling a v2 protocol encrypt
service.

Performs the following
  - converts a privacy algorithm to the format needed to send to the service
  - invokes services
  - passes back result

The V2 Protocol request is of the following format

//
// assume a @context
//

ENCRYPT REQUEST sent to the External Obfuscation Service - created from past in values
{
  '@id': ‘ a request id’,
  '@type': http://pn.schema.webshield.io/type#EncryptRequest,
  'https://pn.schema.webshield.io/prop#obfuscation_metadata':
  { // the header
    ‘@id’: “blank node id”,
    ‘@type: http://pn.schema.webshield.io/type#EncryptMetadata’,
    ‘https://pn.schema.webshield.io/prop#content_obfuscation_algorithm’:
    'https://pn.schema.webshield.io/prop#obfuscation_provider':
    'https://pn.schema.webshield.io/prop#kms': 'kms resource object',
    'https://pn.schema.webshield.io/prop#content_encrypt_key_md': 'the key resource'
  },
  // Array of items to encrypt, each item has the following fields
  // id - id for the field, in future will be opaque. This is passed back in the response
  // type - the encrypt metadata that should be used - indicates what encryption to use and the key to use
  // v - the value to encrypt
  // n - optional - if passed in the service should use as the randominess to add
  // aad - optional - if passed in the service should uses as the additional authenticaiton data
  //
  'http://pn.schema.webshield.io/prop#items':
  [
    { ‘id’ : ‘an id', ‘type’: ‘http://.../md-1’, ‘v’ : base64(bytes[]) , n: base64(bytes[], aad: base64(bytes[]},
    { ‘id’ : ‘an id',   ‘type’: ‘http://..../md-1’, ‘v’ : base64(bytes[], n: base64(bytes[], aad: base64(bytes[]) }
  ]
}


//
// Assume an @context to make json-ld
//

ENCRYPT RESPONSE from the External Obfuscation Service
{
  'id': ‘ a response id’,
  'type': 'EncryptResponse',
  'responding_to': the request that was responding to
  // Array of items, there is one item corresponding to each item passed in on ecnrypt request
  // id - the passed in id
  // type - the passed in type
  // v - the encrypted value
  // n - optional - if used the one passed in or created a new one this should be returned here
  // aad - optional - if used the one passed in or created a new one this should be returned here
  //
  'items':
  [
    { ‘id’ : ‘an id', ‘type’: ‘md @id’, ‘v’ : base64(bytes[]) , n: base64(bytes[], aad: base64(bytes[]},
    { ‘id’ : ‘an id',   ‘type’: ‘md @id’, ‘v’ : base64(bytes[], n: base64(bytes[], aad: base64(bytes[]) }
  ]
}

*/

const assert = require('assert');
const loggingMD = {
        ServiceType: 'connector-utils/pstepi-executor/osw',
        FileName: 'v2Encrypt.js', };
const JSONLDPromises = require('jsonld-utils/lib/jldUtils').promises;
const JSONLDUtils = require('jsonld-utils/lib/jldUtils');
const encryptJSONLDContext = require('./model').model.encrypt.v2.jsonldContext;
const PNDataModel = require('data-models/lib/PNDataModel');
const PN_P = PNDataModel.PROPERTY;
const PN_T = PNDataModel.TYPE;
const util = require('util');

let utils = {};

//
// serviceCtx
// items an array of OItems
// props.os - the obfuscation service pn resource
// props.kms - the kms service pn resource
// props.cekmd - content encrypt key metadata
// props.pai - privacy action instance
//
// returns an array of {id: the one passed in, value: { PN Obfuscated Value}}
//  Note the PN Obfuscated value @value is already encoded correctly, and @type is set to passed in pai @id
//
utils.execute = function execute(serviceCtx, items, props) {
  'use strict';
  assert(serviceCtx, 'execute - serviceCtx param missing');
  assert(items, 'execute - items param missing');
  assert(props, 'execute - props param missing');
  assert(props.msgId, util.format('execute - props.msgId param missing:%j', props));
  assert(props.pai, util.format('execute - props.pai param missing:%j', props));
  assert(props.kms, util.format('execute - props.kms param missing:%j', props));
  assert(props.os, util.format('execute - props.os param missing:%j', props));
  assert(props.cekmd, util.format('execute - props.cekmd param missing:%j', props));

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'v2Encrypt-Start',
                                      msgId: props.msgId, }, loggingMD);

  return model.promiseCompactEncryptRequest(items, props)
    .then(function (compactRequest) {

      serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'v2Encrypt-Created-Encrypt-Request',
                                          msgId: props.msgId,
                                          data: compactRequest, }, loggingMD);

      //
      // for now just create a canon response, so can hook up and test
      // add actual code later
      //
      let encryptedItems = items;
      for (let i = 0; i < items.length; i++) {
        encryptedItems[i].v = 'cipher-' + i;
      }

      serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'v2Encrypt-End',
                                          msgId: props.msgId,
                                          data: encryptedItems, }, loggingMD);

      return encryptedItems;

    });
};

let model = {};

// create encrypt metadata that is passed to the external service
model.createEncryptMetadata = function createEncryptMetadata(props) {
  'use strict';

  /* The format of the external metadata
  {
    ‘@id’: “blank node id”,
    ‘@type: http://pn.schema.webshield.io/type#EncryptMetadata’,
    ‘https://pn.schema.webshield.io/prop#content_obfuscation_algorithm’:
    'https://pn.schema.webshield.io/prop#obfuscation_provider':
    'https://pn.schema.webshield.io/prop#kms': 'kms resource object',
    'https://pn.schema.webshield.io/prop#content_encrypt_key_md': 'the key resource'
  }, */

  let md = {};
  md = JSONLDUtils.createBlankNode({ '@type': PN_T.EncryptMetadata, });
  md[PN_P.contentObfuscationAlgorithm] = props.pai[PN_P.contentObfuscationAlgorithm];
  md[PN_P.obfuscationProvider] = props.pai[PN_P.obfuscationProvider];
  md[PN_P.kms] = props.kms;
  md[PN_P.contentEncryptKeyMD] = props.cekmd;

  return md;

};

// create encrypt items that are sent to teh service
model.createEncryptItems = function createEncryptItems(items, encryptMetadata) {
  'use strict';

  /*

    For obfuscate, assume that the based in value is string that needs to be converted to a byte array that will be
    base64 encoded. Note if this was a multi step then may alrady be in the correct format. In future can add props to control

    The jsonld compact format of external items is the following, this returns the expanded version

    { ‘id’ : ‘an id', ‘type’: ‘http://.../md-1’, ‘v’ : base64(bytes[]) , n: base64(bytes[], aad: base64(bytes[]},

  */

  let result = [];
  for (let i = 0; i < items.length; i++) {

    let ei = { '@id': items[i].id, '@type': encryptMetadata['@id'], };

    // convert to base64, note kind of assumes input is a string need to look at other types
    ei[PN_P.v] = Buffer.from(items[i].v).toString('base64');

    result.push(ei);
  }

  return result;
};

model.promiseCompactEncryptRequest = function promiseCompactEncryptRequest(items, props) {
  'use strict';

  let eRequest = {
    '@id': '_:add uuid',
    '@type': PN_T.EncryptRequest, };

  //
  // Create the external encryptMetadata that needs to be sent to the external service
  // these are blank nodes created just for this call
  //
  eRequest[PN_P.encryptionMetadata] = model.createEncryptMetadata(props);

  //
  // Create the external item information from the passed in items and set
  // type to the newley created encrypt metadata. Reuse the id so can link back
  //
  eRequest[PN_P.items2] = model.createEncryptItems(items, eRequest[PN_P.encryptionMetadata]);

  //
  // Compact the request as easier for parties to deal with
  //
  return JSONLDPromises.compact(eRequest, encryptJSONLDContext);
};

model.createItems = {};

module.exports = {
  execute: utils.execute,
  model: model, // expose so can test
};
