/*jslint node: true, vars: true */
const v2Encrypt = require('../../lib/osw/v2Encrypt');
const KMSCanons = require('metadata/lib/kms').canons;
const OSCanons = require('metadata/lib/obfuscationService').canons;
const PNOVUtils = require('data-models/lib/PNObfuscatedValue').utils;
const PSICanons = require('metadata/lib/PrivacyStepInstance').canons;
const should = require('should');
const testUtils = require('node-utils/testing-utils/lib/utils');

describe('YES v2Encrypt - tests', function () {
  'use strict';

  let dummyServiceCtx;

  let props = {};
  props.msgId = 'msgId1';
  props.kms = KMSCanons.createTestKMS({ hostname: 'hostname', domainName: 'domainName', });
  props.os = OSCanons.createTestObfuscationService({ hostname: 'hostname', domainName: 'domainName', });
  props.pai = PSICanons.createObfuscatePrivacyStepI({ hostname: 'hostname', domainName: 'domainName', });
  props.cekmd = 'add content encryption key md';

  let items = [];
  items.push(PNOVUtils.createOItem('id1', 'type1', 'value1'));
  items.push(PNOVUtils.createOItem('id2', 'type2', 'value2'));

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

  describe('1 validate create compact request', function () {

    it('1.1 should return a promise that contains the encrypted items', function () {
      return v2Encrypt.model.promiseCompactEncryptRequest(items, props)
        .then(function (result) {
          result.should.have.property('@context');
          result.should.have.property('id');
          result.should.have.property('type', 'EncryptRequest');
          result.should.have.property('encryption_metadata');
          result.should.have.property('items');

          result.encryption_metadata.should.have.property('id');
          result.encryption_metadata.should.have.property('type', 'EncryptMetadata');
          result.encryption_metadata.should.have.property('content_encrypt_key_md');
          result.encryption_metadata.should.have.property('kms');
          result.encryption_metadata.kms.should.have.property('id');
          result.encryption_metadata.kms.should.have.property('type');
          result.encryption_metadata.kms.should.have.property('algorithm');
          result.encryption_metadata.kms.should.have.property('provider');

          console.log('*******', result.items);

          for (let i = 0; i < result.items.length; i++) {
            console.log(items[i]);
            result.items[i].should.have.property('id');
            result.items[i].should.have.property('type');
            result.items[i].should.have.property('v');
          }
        });
    }); //it 1.1
  }); // describe 1

  describe('2 execute encryption', function () {

    it('2.1 should return a promise that contains the encrypted items', function () {
      let promiseResult = v2Encrypt.execute(dummyServiceCtx, items, props);
      return promiseResult.then(function (result) {
        result.length.should.equal(2);
        result[0].should.have.property('v', 'cipher-0');
      });
    }); //it 2.1
  }); // describe 2

}); // describe
