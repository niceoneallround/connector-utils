/*jslint node: true, vars: true */
const HttpStatus = require('http-status');
const assert = require('assert');
const JWTUtils = require('jwt-utils/lib/jwtUtils').jwtUtils;
const nock = require('nock');
const OSCanons = require('metadata/lib/obfuscationService').canons;
const promiseOS = require('../lib/promiseOS').execute;
const should = require('should');
const testUtils = require('node-utils/testing-utils/lib/utils');
const util = require('util');

describe('Promise Fetch Obfuscation Service Metadata Tests', function () {
  'use strict';

  let dummyServiceCtx;
  const API_GATEWAY_URL = 'http://fake.api.gateway';

  before(function (done) {
    let props = {};
    props.name = 'test-service';
    testUtils.createDummyServiceCtx(props, function (ctx) {
      dummyServiceCtx = ctx;
      dummyServiceCtx.config = testUtils.getTestServiceConfig(
          { port: '2325',
            API_GATEWAY_URL: API_GATEWAY_URL,
            DOMAIN_NAME: 'test.webshield.io', });
      done();
    });
  });

  it('1.1 should post a request to the metadata service and return a structure with OS', function () {

    //
    // Nock out call to get metadata
    //
    let OSMD = createOSMD();
    let pathUrl = '/v1/metadata/obfuscation_service___io___webshield___test--test-os-1';
    nock(API_GATEWAY_URL)
          .log(console.log)
          .get(pathUrl)
          .reply(function () { // not used uri, requestBody) {
            return [
              HttpStatus.OK,
              createMDJWT(OSMD),
              { 'content-type': 'text/plain', },
            ];
          });

    return promiseOS(dummyServiceCtx, OSMD['@id'], 'msg-1', 'actionMsg-1')
      .then(function (result) {
        result.should.have.property('OS');
      },

      function (err) {
        assert(false, util.format('Unexpected error:%j', err));
        throw err;
      });

  });

  //--------------
  // Test Helpers
  //--------------

  function createMDJWT(md) {
    return JWTUtils.signMetadata(md, dummyServiceCtx.config.crypto.jwt, { subject: md['@id'] });
  }

  // Canon
  function createOSMD() {
    let props =   { hostname: dummyServiceCtx.config.getHostname(),
        domainName: dummyServiceCtx.config.DOMAIN_NAME,
        issuer: 'abc.com', creationTime: '282828', };

    return OSCanons.createTestObfuscationService(props);
  }

}); // describe
