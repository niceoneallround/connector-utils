/*jslint node: true, vars: true */
const assert = require('assert');
const conMDUtils = require('../lib/utils');
const HttpStatus = require('http-status');
const JWTUtils = require('jwt-utils/lib/jwtUtils').jwtUtils;
const nock = require('nock');
const MDUtils = require('metadata/lib/md').utils;
const PNDataModel = require('data-models/lib/PNDataModel');
const should = require('should');
const testUtils = require('node-utils/testing-utils/lib/utils');
const util = require('util');

describe('Utils-Metadata', function () {
  'use strict';

  const API_GATEWAY_URL = 'http://fake.api.gateway';
  let dummyServiceCtx;

  function createPrivacyAlgorithmJWT(privacyAlgorithm) {
    return JWTUtils.signMetadata(privacyAlgorithm, dummyServiceCtx.config.crypto.jwt, { subject: privacyAlgorithm['@id'] });
  }

  function createPrivacyAlgorithm() {
    let yaml = {
      id: '23',
      type: 'privacyalgorithmv2',
      description: 'A valid PA that shows all the mandatory fields, except this one',
      privacy_step: [{
        id: 'pstep-1',
        description: 'a test privacy step',
        node_type: 'connector',
        privacy_action: [{
          id: 'paction-1',
          content_obfuscation_algorithm: 'A256GCM',
          obfuscation_provider: 'http://ionicsecurity.com',
          kms: 'http://md.pn.id.webshield.io/resource/com/acme#my-kms',
          skip_orchestration: false,
          schema:  {
            $schema: 'http://experian.schema.webshield.io',
            'http//json-schema.org/title': 'http://experian.schema.webshield.io/type#Subject',
            'http://json-schema.org/type': 'object', },
        },
      ],
      },
      ],
    };

    // create a JSONLD node
    let md = MDUtils.YAML2Node(yaml,
                { hostname: dummyServiceCtx.config.getHostname(),
                  domainName: dummyServiceCtx.config.DOMAIN_NAME,
                  issuer: 'abc.com', creationTime: '282828', });

    if (PNDataModel.errors.isError(md)) {
      assert(false, util.format('failed to create privacy algorithm:%j', md));
    }

    return md;
  }

  before(function (done) {
    let props = {};
    props.name = 'test1';
    testUtils.createDummyServiceCtx(props, function (ctx) {
      dummyServiceCtx = ctx;
      dummyServiceCtx.config = testUtils.getTestServiceConfig(
          { port: '2325',
            API_GATEWAY_URL: API_GATEWAY_URL,
            DOMAIN_NAME: 'test.webshield.io', });
      done();
    });
  });

  describe('1 Valid Fetch', function () {

    it('1.1 should return the JSON-LD metadata', function (done) {
      let privacyAlgorithm = createPrivacyAlgorithm();
      let mdId = privacyAlgorithm['@id'];

      let msPathUrl = '/v1/metadata/privacy_algorithm___io___webshield___test--23';

      nock(API_GATEWAY_URL)
            .log(console.log)
            .get(msPathUrl)
            .reply(function () { // not used uri, requestBody) {
              return [
                HttpStatus.OK,
                createPrivacyAlgorithmJWT(privacyAlgorithm),
                { 'content-type': 'text/plain', },
              ];
            });

      conMDUtils.promises.fetchMetadata(dummyServiceCtx, mdId, {})
        .then(
          function (mdResource) {
            mdResource.should.have.property('@id');
            done();

          }
        )
        .catch(function (err) {
          assert(false, util.format('1.1 Should not have caught an error:%s', err));
          done();
        });
    }); //it 1.1
  }); // describe 1

  describe('2 InValid Fetch - no nock match so not found', function () {

    it('2.1 should return an error', function (done) {
      let privacyAlgorithm = createPrivacyAlgorithm();
      let mdId = privacyAlgorithm['@id'];
      let msPathUrl = 'not found';

      nock(API_GATEWAY_URL)
            .log(console.log)
            .get(msPathUrl)
            .reply(function () { // not used uri, requestBody) {
              return [
                HttpStatus.OK,
                'should-not-get-here',
                { 'content-type': 'text/plain', },
              ];
            });

      conMDUtils.promises.fetchMetadata(dummyServiceCtx, mdId, {})
        .then(
          function () {
            assert(false, 'should not get here as an error');
            done();
          }
        )
        .catch(function () {
          console.log('-------SHOULD GET AN UNEXPECTED-ERROR NOT-FOUND 404');
          assert(true, 'should-get-here-as-an-error');
          done();
        });
    }); //it 2.1
  }); // describe 1
}); // describe
