/*jslint node: true, vars: true */
const BaseSubjectPNDataModel = require('data-models/lib/BaseSubjectPNDataModel');
const paiExecutor = require('../lib/paiExecutor');
const PAIUtils = require('metadata/lib/PrivacyActionInstance').utils;
const testUtils = require('node-utils/testing-utils/lib/utils');

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

  describe('1 Start Developing', function () {

    it('1.1 Validate that selects correct properties from JSON data', function () {

      let schema = BaseSubjectPNDataModel.model.JSON_SCHEMA;
      let graph = { '@graph': [
        BaseSubjectPNDataModel.canons.createAlice({ domainName: serviceCtx.config.DOMAIN_NAME }),
        BaseSubjectPNDataModel.canons.createBob({ domainName: serviceCtx.config.DOMAIN_NAME }),
      ], };

      // create a privacy action instance to execute
      let props = { hostname: 'fake.hostname', domainName: 'fake.com', pa: 'fake.pa' };
      let paiYAML = {
        id: 'privacy-action-instance-1',
        privacy_action: 'action-1-id',
        obfuscation_service: 'fake.os.id',
        skip_orchestration: false,
        action: 'obfuscate',
        schema: schema,
        encrypt_key_md_jwt: 'keymd_jwt',
      };

      let pai = PAIUtils.YAML2Node(paiYAML, props);

      props = { graph: graph, pai: pai, msgId: '1' };
      return paiExecutor.promises.execute(serviceCtx, props)
        .then(function (result) {
          console.log(result);
        });

    }); //it 1.1
  }); // describe 1

}); // describe
