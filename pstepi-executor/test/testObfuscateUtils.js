/*jslint node: true, vars: true */
const assert = require('assert');
const BaseSubjectPNDataModel = require('data-models/lib/BaseSubjectPNDataModel');
const BASE_P = BaseSubjectPNDataModel.PROPERTY;
const obfuscateUtils = require('../lib/obfuscateUtils');
const testUtils = require('node-utils/testing-utils/lib/utils');
const util = require('util');

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
          console.log('*** RESULT', result);
          result.eitems.length.should.be.equal(6);
          result.eitemsMap.size.should.be.equal(6);

          for (let i = 0; i < result.eitems.length; i++) {
            result.eitems[i].should.have.property('type', 'paiType');
          }
        });

    }); //it 1.1
  }); // describe 1

  describe('2 processOneSubjectMapDataToEncryptItems', function () {

    it('1.1 test alice', function () {

      let schema = BaseSubjectPNDataModel.model.JSON_SCHEMA;
      let alice = BaseSubjectPNDataModel.canons.createAlice({ domainName: serviceCtx.config.DOMAIN_NAME });
      let paiType = 'paiType';

      let result = obfuscateUtils.utils.processOneSubjectMapDataToEncryptItems(
                          serviceCtx, alice, schema, paiType, { msgId: '1' });

      result.eitems.length.should.be.equal(3);
      result.eitemsMap.size.should.be.equal(3);

      for (let i = 0; i < result.eitems.length; i++) {
        result.eitems[i].should.have.property('type', 'paiType');
      }

      result.eitemsMap.forEach(function (value) {
        // should include the follwing fields
        if (value.embedKey) {
          // should be address
          value.id.should.be.equal(alice['@id']);
          value.embedKey.should.be.equal(BASE_P.address);
          value.embed.key.should.be.equal(BASE_P.postalCode);
        } else {
          value.id.should.be.equal(alice['@id']);

          switch (value.key) {

            case BASE_P.taxID:
            case BASE_P.sourceID: {
              break;
            }

            default: {
              assert(false, util.format('Did not expect a map item for key:%s', value.key));
            }
          }
        }
      });

    }); //it 1.1
  }); // describe 1

}); // describe
