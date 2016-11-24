/*jslint node: true, vars: true */
const BaseSubjectPNDataModel = require('data-models/lib/BaseSubjectPNDataModel');
const obfuscateUtils = require('../lib/obfuscateUtils');
const testUtils = require('node-utils/testing-utils/lib/utils');

describe('OBFUSCATE - test obfuscate utils', function () {
  'use strict';

  let serviceCtx;

  before(function (done) {
    testUtils.createDummyServiceCtx({ name: 'dummyName' }, function (ctx) {
      serviceCtx = ctx;
      serviceCtx.config = testUtils.getTestServiceConfig({});
      done();
    });
  });

  describe('1 Test mapping subejct to encrypt items', function () {

    it('1.1 test alice', function () {

      let schema = BaseSubjectPNDataModel.model.JSON_SCHEMA;
      let graph = { '@graph': [
        BaseSubjectPNDataModel.canons.createAlice({ domainName: serviceCtx.config.DOMAIN_NAME }),
        BaseSubjectPNDataModel.canons.createBob({ domainName: serviceCtx.config.DOMAIN_NAME }),
      ], };

      let paiType = 'paiType';

      return obfuscateUtils.promises.mapData2EncryptItems(serviceCtx, graph, schema, paiType, { msgId: 'an-id' })
        .then(function (result) {
          console.log(result);
        });

    }); //it 1.1
  }); // describe 1

  describe('2 processOneSubjectMapDataToEncryptItems', function () {

    it('1.1 test alice', function () {

      let schema = BaseSubjectPNDataModel.model.JSON_SCHEMA;
      let alice = BaseSubjectPNDataModel.canons.createAlice({ domainName: serviceCtx.config.DOMAIN_NAME });
      let paiType = 'paiType';

      let eitems = obfuscateUtils.utils.processOneSubjectMapDataToEncryptItems(
                          serviceCtx, alice, schema, paiType, { msgId: '1' });
      console.log(eitems);

      eitems.length.should.be.equal(3);

      for (let i = 0; i < eitems.length; i++) {
        eitems[i].should.have.property('type', 'paiType');
      }

    }); //it 1.1
  }); // describe 1

}); // describe
