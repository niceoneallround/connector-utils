/*

Contains model information used only by the wrapper to simplify calling
external services

*/

let canons = {};

// creates a canon response from passed in items
canons.encryptResponse = function encryptResponse(inputItems) {
  'use strict';

  let canonRsp = {
    id: '_:1',
    type: 'EncryptResponse',
    responding_to: 'response-id',
    items: [], };

  for (let j = 0; j < inputItems.length; j++) {
    canonRsp.items.push({
      id: inputItems[j].id,
      type: inputItems[j].type,
      v: Buffer.from('cipher-' + j).toString('base64'),
    });
  }

  return canonRsp;

};

module.exports = {
  canons: canons,
};
