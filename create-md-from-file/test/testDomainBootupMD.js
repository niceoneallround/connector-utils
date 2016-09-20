/*jslint node: true, vars: true */

const assert = require('assert');
const createMdFromFile = require('../lib/createMdFromFile');
const JWTUtils = require('jwt-utils/lib/jwtUtils').jwtUtils;
const HttpStatus = require('http-status');
const nock = require('nock');
const testUtils = require('node-utils/testing-utils/lib/utils');
const util = require('util');

describe('test bootupMD for domain/Account', function () {
  'use strict';

  var serviceCtx;

  before(function (done) {
    testUtils.createDummyServiceCtx({ name: 'dummyName' }, function (ctx) {
      serviceCtx = ctx;
      serviceCtx.config = testUtils.getTestServiceConfig({});
      serviceCtx.config.METADATA_FILE = __dirname + '/' + 'validDomain.yml';
      serviceCtx.config.API_GATEWAY_URL = 'http://fake.webshield.io';
      done();
    });
  });

  describe('1 domain tests', function () {

    it('1.1 if account (PNDomain) already exists should just return fetched one', function (done) {
      let fakeId1 = 'http://fake-domain-id1';

      // need to nock out call to the PN to fetch the domain object - note domain name is from the yaml file.
      let fetchScope = nock(serviceCtx.config.API_GATEWAY_URL)
          .log(console.log)
          .get('/v1/domains/abc-com')
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
        results.length.should.be.equal(1);
        results[0].should.have.property('@id', fakeId1);
        done();
      });
    }); // 1.1

    it('1.2 if Domain does NOT exists should create a new one', function (done) {
      let fakeId2 = 'http://fake-domain-id2';

      // need to nock out call to the PN to fetch the domain object - note domain name is from the yaml file.
      let fetchScope = nock(serviceCtx.config.API_GATEWAY_URL)
          .log(console.log)
          .get('/v1/domains/abc-com')
          .reply(function () { // not used uri, requestBody) {
            return [
              HttpStatus.NOT_FOUND,
              '',
              { 'content-type': 'text/plain' },
            ];
          });

      // need to nock out post to metadata service to create
      let postScope = nock(serviceCtx.config.API_GATEWAY_URL)
            .log(console.log)
            .post('/v1/domains')
            .reply(HttpStatus.OK, function (uri, requestBody) {
              this.req.headers.should.have.property('content-type', 'text/plain');

              // check JWT looks as expected
              let verified = JWTUtils.newVerify(requestBody, serviceCtx.config.crypto.jwt);
              let node = JWTUtils.getPnGraph(verified);
              node.should.have.property('@id');
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
