/*jslint node: true, vars: true */
const assert = require('assert');
const pipeUtils = require('../lib/utils');
const HttpStatus = require('http-status');
const nock = require('nock');
const PNDataModel = require('data-models/lib/PNDataModel');
const PN_P = PNDataModel.PROPERTY;
const should = require('should');
const testUtils = require('node-utils/testing-utils/lib/utils');
const util = require('util');

describe('Post JWT 2 Privacy Pipe Tests', function () {
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

  it('1.1 should post to the path', function (done) {

    const pipePathUrl = '/v1/any_url';
    const postURL = API_GATEWAY_URL + pipePathUrl;
    const fakePipe = { '@id': 'fake_pipe', [PN_P.postDataUrl]: postURL, };

    nock(API_GATEWAY_URL)
          .log(console.log)
          .post(pipePathUrl)
          .reply(HttpStatus.OK, function (uri, requestBody) {
            assert(requestBody, 'no request body passed');
            return 'do-not-care';
          });

    pipeUtils.promises.postJWT2Pipe(dummyServiceCtx, fakePipe, 'sendJWT', { msgId: 'id-1', msgAction: 'testing', })
      .then(
        function (result) {
          assert(result, 'no result passed');
          done();
        },

        function (err) {
          assert(false, util.format('1.1 Should not have been passed an error:%s', err));
        }
      )
      .catch(function (err) {
        assert(false, util.format('1.1 Should not have caught an error:%s', err));
      });
  }); //it 1.1

  /*it('1.2 should pass back a BAD_REQUEST', function (done) {

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
  }); //it 1.2*/
}); // describe
