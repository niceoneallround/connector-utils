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
        ServiceType: 'connector-utils/obfuscation-wrapper',
        FileName: 'v2Encrypt.js', };
const util = require('util');

let utils = {};

//
// serviceCtx
// items an array of OItems
// props.os - the obfuscation service resource
// props.kms - the kms service resource
// props.cekm - content encrypt key metadata
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

  serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'v2Encrypt-Start',
                                      msgId: props.msgId,
                                      data: items, }, loggingMD);

  // expand and compact using JSON-LD context

  return new Promise(function (resolve) {

    //
    // for now just create a canon response, so can hook up and test
    // add actual code later
    //
    for (let i = 0; i < items.length; i++) {
      items[i].v = 'cipher-' + i;
    }

    serviceCtx.logger.logJSON('info', { serviceType: serviceCtx.name, action: 'v2Encrypt-End',
                                        msgId: props.msgId,
                                        data: items, }, loggingMD);

    resolve(items);
  });
};

module.exports = {
  execute: utils.execute,
};
