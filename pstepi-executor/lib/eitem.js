/*jslint node: true, vars: true */

const assert = require('assert');
const PNDataModel = require('data-models/lib/PNDataModel');
const PN_P = PNDataModel.PROPERTY;

class Eitem {

  //For each value that needs to be obfuscated this captures the following information
  // id: used to track back and forth across the call to the obfuscation service
  // v: the value to obfuscate - no data conversion
  // props.n: optional nonce
  // props.aad: optional aad
  constructor(id, type, v, props) {

    assert(id, 'EItem - id param missing');
    assert(type, 'EItem - type param missing');
    assert(v, 'EItem - v param missing');
    this.id = id;
    this.type = type;

    // FIXME need to add code to turn v into a byte array
    this.v = v;

    if ((props) && (props.n)) {
      this.n = props.n;
    }

    if ((props) && (props.aad)) {
      this.aad = props.aad;
    }
  }

}

//
// Factory method to create an EItem
//
// An Encrypt Item has the following fields
//  - id - generated from subject id and field name
//  - type - set to the passed in value - the encrypt metadata passed to the service
//  - v - the value to encrypt
//  - n - for now set to null, may be returned by caller - passed in props
//  - aad - for now set to null - can set to the @id the subject - code just knows to do this - passed in props
//
function create(id, type, v, props) {
  'use strict';
  return new Eitem(id, type, v, props);
}

//
// create an obfuscated value from an eitem - see the privacy metadata for more information
// *paiId - the @id of the privacy action instance used to create obfuscated value
// eitem
function makeOVfromEitem(paiId, eitem) {
  'use strict';

  // FIXME add code to determine if need to make bas64 and store accordingly
  // as the code is bytes and storing makes sense to do.

  let ov = {}; // create obfuscated value from eitem
  ov[PN_P.v] = eitem.v; // base64
  ov['@type'] = paiId;

  return ov;
}

module.exports = {
  create: create,
  makeOVfromEitem: makeOVfromEitem,
};
