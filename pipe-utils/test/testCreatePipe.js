/*jslint node: true, vars: true */
const assert = require('assert');
const pipeUtils = require('../lib/utils');
const HttpStatus = require('http-status');
const JWTUtils = require('jwt-utils/lib/jwtUtils').jwtUtils;
const nock = require('nock');

//const PNDataModel = require('data-models/lib/PNDataModel');
const should = require('should');
const testUtils = require('node-utils/testing-utils/lib/utils');
const util = require('util');

describe('Create PrivacyPipe Tests', function () {
  'use strict';

  const API_GATEWAY_URL = 'http://fake.api.gateway';
  let dummyServiceCtx;

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

  it('1.1 should wrap with a JWT, post to the API gateway, and return json object with contents ', function (done) {

    const pipePathUrl = '/v1/privacy_pipe';
    const fakePipe = { '@id': 'fake_pipe' };

    nock(API_GATEWAY_URL)
          .log(console.log)
          .post(pipePathUrl)
          .reply(HttpStatus.OK, function (uri, requestBody) {
            // could check that requewst ok, but as only signing not much value
            console.log(uri);
            assert(requestBody, 'no request body passed');
            return createFakePrivacyPipeResponseJWT();
          });

    pipeUtils.promises.createPrivacyPipe(dummyServiceCtx, 'a-request-id',  fakePipe, {})
      .then(
        function (result) {
          result.should.have.property('pipe');
          result.should.have.property('provision');
          done();

        }
      )
      .catch(function (err) {
        assert(false, util.format('1.1 Should not have caught an error:%s', err));
        done();
      });
  }); //it 1.1

  it('1.2 should pass back a BAD_REQUEST', function (done) {

    const pipePathUrl = '/v1/privacy_pipe';
    const fakePipe = { '@id': 'fake_pipe' };

    nock(API_GATEWAY_URL)
          .log(console.log)
          .post(pipePathUrl)
          .reply(HttpStatus.BAD_REQUEST, function (uri, requestBody) {
            // could check that requewst ok, but as only signing not much value
            console.log(uri);
            assert(requestBody, 'no request body passed');
            return { '@id': 'fake-bad-request', };
          });

    pipeUtils.promises.createPrivacyPipe(dummyServiceCtx, 'a-request-id',  fakePipe, {})
      .then(
        function (result) {
          result.should.have.property('@id', 'fake-bad-request');
          done();

        }
      )
      .catch(function (err) {
        assert(false, util.format('1.1 Should not have caught an error:%s', err));
        done();
      });
  }); //it 1.2

  //------------------
  // helpers
  // -----------------
  function createFakePrivacyPipeResponseJWT() {
    //
    // need to return a JWT that has a metadata claim and a provision claim
    // does not matter what is in it
    //
    let md = { '@id': 'fake_md' };
    let props = {
      provision: 'fake_provision',
      subject: md['@id'],
    };

    return JWTUtils.signMetadata(md, dummyServiceCtx.config.crypto.jwt, props);
  }
}); // describe
