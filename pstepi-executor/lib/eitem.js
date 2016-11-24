/*jslint node: true, vars: true */

const assert = require('assert');

/*

Describes an encrypt item that is passed to the encryption service contains
the following fields

*/

class Eitem {
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

module.exports = {
  create: create,
};
