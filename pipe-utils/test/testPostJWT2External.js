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

describe('Post JWT 2 External', function () {
  'use strict';

  const EXTERNAL_CLIENT  = 'http://fake.test.webshield.io';
  let dummyServiceCtx;

  before(function (done) {
    let props = {};
    props.name = 'test1';
    testUtils.createDummyServiceCtx(props, function (ctx) {
      dummyServiceCtx = ctx;
      dummyServiceCtx.config = testUtils.getTestServiceConfig(
          { port: '2325',
            DOMAIN_NAME: 'test.webshield.io', });
      done();
    });
  });

  it('1.1 should post to the path in pipe', function (done) {

    const pipePathUrl = '/v1/1_1';
    const postURL = EXTERNAL_CLIENT + pipePathUrl;
    const fakePipe = { '@id': 'fake_pipe', [PN_P.postDataUrl]: postURL, };

    nock(EXTERNAL_CLIENT)
          .log(console.log)
          .post(pipePathUrl)
          .reply(HttpStatus.OK, function (uri, requestBody) {
            assert(requestBody, 'no request body passed');
            return 'do-not-care';
          });

    pipeUtils.promises.postJWT2External(dummyServiceCtx, fakePipe, 'sendJWT', { msgId: 'id-1', msgAction: 'testing', })
      .then(
        function (result) {
          result.body.should.be.equal('do-not-care');
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

  it('1.2 should post to pipe and handle BAD_REQUEST', function () {
    const pipePathUrl = '/v1/1_1';
    const postURL = EXTERNAL_CLIENT + pipePathUrl;
    const fakePipe = { '@id': 'fake_pipe', [PN_P.postDataUrl]: postURL, };

    nock(EXTERNAL_CLIENT)
          .log(console.log)
          .post(pipePathUrl)
          .reply(HttpStatus.BAD_REQUEST, function (uri, requestBody) {
            assert(requestBody, 'no request body passed');
            return 'do-not-care';
          });

    return pipeUtils.promises.postJWT2External(dummyServiceCtx, fakePipe, 'sendJWT', { msgId: 'id-1', msgAction: 'testing', })
      .then(
        function (result) {
          assert(false, util.format('1.2 Should have passed an error:%s', result));
        },

        function (err) {
          err.body.should.be.equal('do-not-care');
        }
      )
      .catch(function (err) {
        assert(false, util.format('1.2 Should not have caught an error:%s', err));
      });
  }); //it 1.2

  it('1.3 should post to pipe and handle FORBIDDEN', function () {
    const pipePathUrl = '/v1/1_3';
    const postURL = EXTERNAL_CLIENT + pipePathUrl;
    const fakePipe = { '@id': 'fake_pipe', [PN_P.postDataUrl]: postURL, };

    nock(EXTERNAL_CLIENT)
          .log(console.log)
          .post(pipePathUrl)
          .reply(HttpStatus.FORBIDDEN, function (uri, requestBody) {
            assert(requestBody, 'no request body passed');
            return 'do-not-care';
          });

    return pipeUtils.promises.postJWT2External(dummyServiceCtx, fakePipe, 'sendJWT', { msgId: 'id-1', msgAction: 'testing', })
      .then(
        function (result) {
          assert(false, util.format('1.3 Should have passed an error:%s', result));
        },

        function (err) {
          err.should.have.property('@id'); // should be PN error;
        }
      )
      .catch(function (err) {
        assert(false, util.format('1.3 Should not have caught an error:%s', err));
      });
  }); //it 1.3*/

  it('1.4 should post to pipe and handle NOT_FOUND', function () {
    const pipePathUrl = '/v1/1_4';
    const postURL = EXTERNAL_CLIENT + pipePathUrl;
    const fakePipe = { '@id': 'fake_pipe', [PN_P.postDataUrl]: postURL, };

    nock(EXTERNAL_CLIENT)
          .log(console.log)
          .post(pipePathUrl)
          .reply(HttpStatus.NOT_FOUND, function (uri, requestBody) {
            assert(requestBody, 'no request body passed');
            return 'do-not-care';
          });

    return pipeUtils.promises.postJWT2External(dummyServiceCtx, fakePipe, 'sendJWT', { msgId: 'id-1', msgAction: 'testing', })
      .then(
        function (result) {
          assert(false, util.format('1.4 Should have passed an error:%s', result));
        },

        function (err) {
          err.should.have.property('@id'); // should be PN error;
        }
      )
      .catch(function (err) {
        assert(false, util.format('1.4 Should not have caught an error:%s', err));
      });
  }); //it 1.4*/

}); // describe
