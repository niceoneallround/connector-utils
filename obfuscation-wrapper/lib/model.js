/*

Contains model information used only by the wrapper to simplify calling
external services

*/

let model = {};
model.jsonldContext = {};

model.jsonldContext.v2 = {};

// context used on v2 encrypt and decrypt messages
model.jsonldContext.v2.encrypt = {
  id: '@id',
  type: '@type',
  pnp: 'https://dc.test.schema.webshield.io/prop#',
  pnt: 'https://dc.test.schema.webshield.io/type#',

  EncryptRequest: 'pnt:EncryptRequest',
  EncryptResponse: 'pnt:EncryptResponse',

  aad: 'pnp:aad',
  items: 'pnp:items',
  n: 'pnp:n',
  v: 'pnp:v',
};

module.exports = {
  model: model,
};
