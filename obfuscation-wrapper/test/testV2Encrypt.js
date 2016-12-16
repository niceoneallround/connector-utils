/*jslint node: true, vars: true */
const v2Encrypt = require('../lib/v2Encrypt');
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
      let promiseResult = v2Encrypt.execute(dummyServiceCtx, {}, {});
      return promiseResult.then(function (result) {
        result.should.equal('a');
      });
    }); //it 1.1
  }); // describe 1

}); // describe
