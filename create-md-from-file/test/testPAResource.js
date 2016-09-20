/*jslint node: true, vars: true */

const apigwRequestWrapper = require('node-utils/apigwRequestWrapper/lib/apigwRequestWrapper');
const assert = require('assert');
const createMdFromFile = require('../lib/createMdFromFile');
const JWTClaims = require('jwt-utils/lib/jwtUtils').claims;
const JWTUtils = require('jwt-utils/lib/jwtUtils').jwtUtils;
const HttpStatus = require('http-status');
const nock = require('nock');
const PNDataModel = require('data-models/lib/PNDataModel');
const testUtils = require('node-utils/testing-utils/lib/utils');
const util = require('util');

describe('test bootupMD for Privacy Algorithm Resource', function () {
  'use strict';

  var serviceCtx;

  before(function (done) {
    testUtils.createDummyServiceCtx({ name: 'dummyName' }, function (ctx) {
      serviceCtx = ctx;
      serviceCtx.config = testUtils.getTestServiceConfig({});
      serviceCtx.config.DOMAIN_NAME = 'abc.com';
      serviceCtx.config.METADATA_FILE = __dirname + '/' + 'validPAResource.yml';
      serviceCtx.config.API_GATEWAY_URL = 'http://patest.fake.webshield.io';
      done();
    });
  });

  describe('1 PA tests', function () {

    it('1.1 if Privacy Algorithm already exists should just return fetched one', function (done) {
      let fakeId1 = 'http://fake-domain-id1/pa#1';

      // need to nock out call to the PN to fetch the domain object - NOTE USE AWSGW version
      let mdId = 'https://md.pn.id.webshield.io/privacy_algorithm/com/abc#in-bound-pa';
      let mdIdParam = PNDataModel.ids.paramUtils.createMdParamFromMdId(mdId);
      let urlFrag = apigwRequestWrapper.utils.generateAWSGWFetchMetadataPathUrl(mdIdParam);
      console.log(urlFrag);
      let fetchScope = nock(serviceCtx.config.API_GATEWAY_URL)
          .log(console.log)
          .get(urlFrag)
          .reply(function () { // not used uri, requestBody) {
            return [
              HttpStatus.OK,
              JWTUtils.signData({ '@id': fakeId1 }, serviceCtx.config.crypto.jwt),
              { 'content-type': 'text/plain' },
            ];
          });

      createMdFromFile.execute(serviceCtx, {}, function (err, results) {
        assert(!err, util.format('did not expect err:%j', err));
        fetchScope.isDone();
        console.log(results);
        results.length.should.be.equal(1);
        done();
      });
    }); // 1.1

    it('1.2 if Metadata PA does NOT exists should create a new one', function (done) {
      let fakeId2 = 'http://fake-domain-id2';

      // need to nock out call to the PN to fetch the domain object - NOTE USE AWSGW version
      let mdId = 'https://md.pn.id.webshield.io/privacy_algorithm/com/abc#in-bound-pa';
      let mdIdParam = PNDataModel.ids.paramUtils.createMdParamFromMdId(mdId);
      let urlFrag = apigwRequestWrapper.utils.generateAWSGWFetchMetadataPathUrl(mdIdParam);
      console.log(urlFrag);
      let fetchScope = nock(serviceCtx.config.API_GATEWAY_URL)
          .log(console.log)
          .get(urlFrag)
          .reply(function () { // not used uri, requestBody) {
            return [
              HttpStatus.NOT_FOUND,
              {},
              { 'content-type': 'text/plain' },
            ];
          });

      // need to nock out post to metadata service to create
      let postScope = nock(serviceCtx.config.API_GATEWAY_URL)
            .log(console.log)
            .post('/v1/metadata')
            .reply(HttpStatus.OK, function (uri, requestBody) {
              this.req.headers.should.have.property('content-type', 'text/plain');

              // JWT send to ms should have a metadata claim
              let verified = JWTUtils.newVerify(requestBody, serviceCtx.config.crypto.jwt);
              console.log(verified);
              let node = verified[JWTClaims.METADATA_CLAIM];
              node.should.have.property('@type');

              // return known id so can check
              return JWTUtils.signData({ '@id': fakeId2 }, serviceCtx.config.crypto.jwt);
            });

      createMdFromFile.execute(serviceCtx, {}, function (err, results) {
        assert(!err, util.format('create got unexpected expect err:%s', err));
        fetchScope.isDone();
        postScope.isDone();
        results.length.should.be.equal(1);
        results[0].should.have.property('@id', fakeId2);
        done();
      });
    }); // 1.2
  }); // 1

});
