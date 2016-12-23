/*jslint node: true, vars: true */
const assert = require('assert');
const BaseSubjectPNDataModel = require('data-models/lib/BaseSubjectPNDataModel');
const JSONLDUtils = require('jsonld-utils/lib/jldUtils').npUtils;
const KMSCanons = require('metadata/lib/kms').canons;
const localTestCanons = require('./utils').canons;
const HttpStatus = require('http-status');
const nock = require('nock');
const OSCanons = require('metadata/lib/obfuscationService').canons;
const paiExecutor = require('../lib/paiExecutor');
const PAIUtils = require('metadata/lib/PrivacyActionInstance').utils;
const PNDataModel = require('data-models/lib/PNDataModel');
const PN_T = PNDataModel.TYPE;
const testUtils = require('node-utils/testing-utils/lib/utils');
const util = require('util');

describe('PAI Test Privacy Action Instance Executor', function () {
  'use strict';

  let serviceCtx;

  before(function (done) {
    testUtils.createDummyServiceCtx({ name: 'dummyName' }, function (ctx) {
      serviceCtx = ctx;
      serviceCtx.config = testUtils.getTestServiceConfig({});
      done();
    });
  });

  describe('1 Ensure can obfuscate data to a privacy graph - note lower levels check results so do not repeat', function () {

    it('1.1 Obfuscate alice and bob should produce privacy graphs of there information', function () {

      let schema = BaseSubjectPNDataModel.model.JSON_SCHEMA;
      let graph = { '@graph': [
        BaseSubjectPNDataModel.canons.createAlice({ domainName: serviceCtx.config.DOMAIN_NAME }),
        BaseSubjectPNDataModel.canons.createBob({ domainName: serviceCtx.config.DOMAIN_NAME }),
      ], };

      // create a privacy action instance to execute
      let props1 = { hostname: 'fake.hostname', domainName: 'fake.com', pa: 'fake.pa' };

      let paiYAML = {
        id: 'privacy-action-instance-1',
        privacy_action: 'action-1-id',
        obfuscation_service: 'fake.os.id',
        skip_orchestration: false,
        action: 'obfuscate',
        schema: schema,
        encrypt_key_md_jwt: 'keymd_jwt',
      };

      let pai = PAIUtils.YAML2Node(paiYAML, props1);

      // nock out call to the obfuscation service
      nock('http://test.webshield.io')
            .log(console.log)
            .defaultReplyHeaders({ 'Content-Type': 'application/json', })
            .post('/obfuscation_service/v2/encrypt')
            .reply(HttpStatus.OK, function (uri, requestBody) {
              requestBody.should.have.property('type', 'EncryptRequest');
              return localTestCanons.encryptResponse(requestBody.items);
            });

      let props = { graph: graph,
                pai: pai,
                msgId: '1',
                kms: KMSCanons.createTestKMS(props1),
                os: OSCanons.createTestObfuscationService(props1),
                cekmd: 'content encrypt key md', };
      return paiExecutor.promises.execute(serviceCtx, props)
        .then(function (result) {
          let pgs = result['@graph'];
          pgs.length.should.be.equal(2);

          for (let i = 0; i < pgs.length; i++) {
            let pg = pgs[i];

            // perform some basic check as lower levels are already tested
            assert(JSONLDUtils.isType(pg, PN_T.PrivacyGraph), util.format('Expected type Privacy Graph:%j', pg));
            pg.should.have.property('https://schema.org/givenName');
            pg['https://schema.org/givenName'].should.have.property('@type', pai['@id']);
            pg['https://schema.org/givenName'].should.have.property('@value');
          }
        });

    }); //it 1.1
  }); // describe 1

}); // describe
