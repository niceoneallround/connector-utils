/*jslint node: true, vars: true */
const v2Encrypt = require('../../lib/osw/v2Encrypt');
const PNOVUtils = require('data-models/lib/PNObfuscatedValue').utils;
const should = require('should');
const testUtils = require('node-utils/testing-utils/lib/utils');

describe('YES v2Encrypt - tests', function () {
  'use strict';

  let dummyServiceCtx;

  before(function (done) {
    let props = {};
    props.name = 'test1';
    testUtils.createDummyServiceCtx(props, function (ctx) {
      dummyServiceCtx = ctx;
      dummyServiceCtx.config = testUtils.getTestServiceConfig(
          { port: '2325',
            DOMAIN_NAME: 'test.webshield.io', });
      done();
    });
  });

  describe('1 execute', function () {

    it('1.1 should return a promise', function () {
      let items = [];
      items.push(PNOVUtils.createOItem('id1', 'type1', 'value1'));
      items.push(PNOVUtils.createOItem('id2', 'type2', 'value2'));
      let promiseResult = v2Encrypt.execute(dummyServiceCtx, items, { msgId: 'msgId1', });
      return promiseResult.then(function (result) {
        result.length.should.equal(2);
        result[0].should.have.property('v', 'cipher-0');
      });
    }); //it 1.1
  }); // describe 1

}); // describe
