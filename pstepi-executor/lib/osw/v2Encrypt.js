/*

Returns a promise containing the encrypted items after calling a v2 protocol encrypt
service. In the following format

{ '@graph': [
  { id: 'passed in id', ov: the PN obfuscated Value  }
]}

Performs the following
  - converts a privacy algorithm to the format needed to send to the service
  - invokes services
  - passes back result

The V2 Protocol request is of the following format

//
// assume a @context
//

The ENCRYPT REQUEST sent to the External Obfuscation Service - created from past in values
{  // The compact jsonld context
  '@context': 'JSON LD context',
  'id': ‘ a request id’,
  'type': EncryptRequest,
  'encryption_metadata'[:
  { // the header
    ‘id’: “blank node id”,
    ‘type: http://pn.schema.webshield.io/type#EncryptMetadata’,
    ‘content_obfuscation_algorithm’:
    'obfuscation_provider':
    'content_encrypt_key_md_jwt': the JWT holding the content encrypt key that is decoded in the content_encrypt_key_md
    'content_encrypt_key_md': { // a compact version of content encrypt key md
      'id':
      'type': EncryptKeyMetadata, Metadata,
      'raw_encrypt_key_md_type': jsonwebkey, json, or jwt
      'raw_encrypt_key_md': depends on type, acts as follows
        'jwt': base64 encoded value
        'json or jsonwebkey': the object

    }]
  },
  // Array of items to encrypt, each item has the following fields
  // id - id for the field, in future will be opaque. This is passed back in the response
  // type - the encrypt metadata that should be used - indicates what encryption to use and the key to use
  // v - the value to encrypt
  // n - optional - if passed in the service should use as the randominess to add
  // aad - optional - if passed in the service should uses as the additional authenticaiton data
  //
  'items':
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
const JSONLDUtilsNp = require('jsonld-utils/lib/jldUtils').npUtils;
const encryptJSONLDContext = require('./model').model.encrypt.v2.jsonldContext;
const PNDataModel = require('data-models/lib/PNDataModel');
const PN_P = PNDataModel.PROPERTY;
const PN_T = PNDataModel.TYPE;
const PNOVUtils = require('data-models/lib/PNObfuscatedValue').utils;
const requestWrapperPromises = require('node-utils/requestWrapper/lib/requestWrapper').promises;
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

  let promiseEncryptResult = model.promiseCompactEncryptRequest(items, props)
    .then(function (compactRequest) {

      serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'v2Encrypt-Created-Encrypt-Request',
                                          msgId: props.msgId,
                                          data: compactRequest, }, loggingMD);

      //
      // As a convenience if the raw_encrypt_key_md is a JSON or JSONWebKey type then
      // expand it for the caller, need to do here to ensure compact does not remove
      // any non URL props or types
      //
      let cemkd = compactRequest.encryption_metadata.content_encrypt_key_md;
      switch (cemkd.raw_encrypt_key_md_type.toLowerCase()) {

        case 'jsonwebkey':
        case 'json': {
          // docode the base64 string into a JSON object
          let v = cemkd.raw_encrypt_key_md;
          let js = Buffer.from(v, 'base64').toString();
          let jo = JSON.parse(js);
          cemkd.raw_encrypt_key_md = jo;
          break;
        }

        default: {
          // just pass thru the raw encrypt key metadata base64 as is do not convert to a json
          // object
          break;
        }
      }

      // Compact may have converted the encryption metadata from an array to an object
      // convert so always an array for external services
      if (!Array.isArray(compactRequest.encryption_metadata)) {
        compactRequest.encryption_metadata = [compactRequest.encryption_metadata];
      }

      serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'v2Encrypt-Created-Encrypt-Request-Post-Expand-Raw',
                                          msgId: props.msgId,
                                          data: compactRequest, }, loggingMD);

      //
      // Invoke the obfuscation service to encrypt the items
      //
      let postProps = {};
      postProps.url = JSONLDUtilsNp.getV(props.os, PN_P.obfuscateEndpoint);
      postProps.json = compactRequest;

      serviceCtx.logger.logProgress(util.format('POST EncryptRequest to Obfuscation Service:%s', postProps.url));

      return requestWrapperPromises.postJSON(postProps);
    });

  return promiseEncryptResult
    .then(
      function (response) {

        serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'v2Encrypt-Response-From-Encryption-Service',
                                            msgId: props.msgId,
                                            data: response.body, }, loggingMD);

        // create the response items
        let body = JSON.parse(response.body);
        let items = body.items;
        let encryptedItems = [];
        for (let i = 0; i < items.length; i++) {
          encryptedItems.push({
            id: items[i].id,
            ov: PNOVUtils.createOVFromOItem({ type: props.pai['@id'], v: items[i].v, n: items[i].n, aad: items[i].aad, }), // create Obfuscated Value
          });
        }

        serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'v2Encrypt-End',
                                            msgId: props.msgId,
                                            data: encryptedItems, }, loggingMD);

        return { '@graph': encryptedItems, };
      },

    function (err) {
      // error calling encrypt
      serviceCtx.logger.logJSON('error', { serviceType: serviceCtx.name, action: 'v2Encrypt-Error-Calling-Encryption-Service',
                                          msgId: props.msgId,
                                          err: err, }, loggingMD);
      throw err;
    });
};

//---------------------
// Utils
//----------------------

let model = {};

// create encrypt metadata that is passed to the external service
model.createEncryptMetadata = function createEncryptMetadata(props) {
  'use strict';

  /* The compact form
    { // the header
      ‘id’: “blank node id”,
      ‘type: http://pn.schema.webshield.io/type#EncryptMetadata’,
      ‘content_obfuscation_algorithm’:
      'obfuscation_provider':
      'content_encrypt_key_md_jwt': the JWT holding the content encrypt key that is decoded in the content_encrypt_key_md
      'content_encrypt_key_md': { // a compact version of content encrypt key md
        'id':
        'type': EncryptKeyMetadata, Metadata,
        'raw_encrypt_key_md_type': jsonwebkey, json, or jwt
        'raw_encrypt_key_md': depends on type, acts as follows
          'jwt': base64 encoded value
          'json or jsonwebkey': the object // performed after the jsonld compact has occured

      }
    },
    */

  let md = {};
  md = JSONLDUtils.createBlankNode({ '@type': PN_T.EncryptMetadata, });
  md[PN_P.contentObfuscationAlgorithm] = props.pai[PN_P.contentObfuscationAlgorithm];
  md[PN_P.obfuscationProvider] = props.pai[PN_P.obfuscationProvider];
  md[PN_P.contentEncryptKeyMDJWT] = 'add code to set JWT';

  // create an expanded version that is used as convenience
  let decodedCEKMD = {
    '@id': props.cekmd['@id'],
    '@type': props.cekmd['@type'],
  };

  decodedCEKMD[PN_P.rawEncryptKeyMDType] = props.cekmd[PN_P.rawEncryptKeyMDType];
  decodedCEKMD[PN_P.rawEncryptKeyMD] = props.cekmd[PN_P.rawEncryptKeyMD];
  md[PN_P.contentEncryptKeyMD] = decodedCEKMD;

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

  let eRequest = JSONLDUtils.createBlankNode({ '@type': PN_T.EncryptRequest, });

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
