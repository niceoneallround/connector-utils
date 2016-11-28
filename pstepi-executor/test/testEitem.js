/*jslint node: true, vars: true */
const eitemFactory = require('../lib/eitem');
const PNDataModel = require('data-models/lib/PNDataModel');
const PN_P = PNDataModel.PROPERTY;
const should = require('should');

describe('EITEM - tests', function () {
  'use strict';

  describe('1 create', function () {

    it('1.1 should created an eitem with just id, type and v', function () {
      let eitem = eitemFactory.create('id1', 'type1', 'value1');
      eitem.should.have.property('id', 'id1');
      eitem.should.have.property('type', 'type1');
      eitem.should.have.property('v', 'value1');
    }); //it 1.1
  }); // describe 1

  describe('2 makeOVfromEitem', function () {

    it('2.1 should create an obfuscated value from an eitem', function () {
      let eitem = eitemFactory.create('id1', 'type1', 'value1');
      let ov = eitemFactory.makeOVfromEitem('paiId', eitem);
      ov.should.not.have.property('@id');
      ov.should.have.property('@type', 'paiId');
      ov.should.have.property(PN_P.v, 'value1');
    }); //it 1.1
  }); // describe 1

}); // describe
