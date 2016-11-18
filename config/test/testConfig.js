/*jslint node: true, vars: true */

const assert = require('assert');
const configFactory = require('../lib/configFactory');
const fs = require('fs');
const should = require('should');
const yaml = require('js-yaml');

function createCanonConfigFile() {
  'use strict';
  return {
    version: 1,
    data_connector: {
      DOMAIN_NAME: 'test.com',
      LISTEN_PORT: '8081',
      LISTEN_PORT_INSIDE_DOCKER: '8082',
      api_gateway: {
        url: 'url1',
        webshield_api_key: '23',
      },
      is: {
        post_subject_url: 'post_subject_url',
        post_subject_query_url: 'post_subject_query_url',
      },
      metadata: {
        file: 'a.1',
        skip_startup_create: false,
      },
      terminate_tls: {
        enabled: true,
        certificate_file: '../test/test-data/file1',
        private_key_file: '../test/test-data/file2',
      },
      jwt: {
        signer: {
          alg: 'RS256',
          RS256: {
            certificate_file: '../test/test-data/file3',
            public_key_file: '../test/test-data/file4',
            private_key_file: '../test/test-data/file5',
          },
        },
        verifier: {
          enabled: true,
        },
      },
    },
  };
}

describe('1 config file tests', function () {
  'use strict';

  it('1.1 should verify and return config if all props are valid', function () {

    let cf = createCanonConfigFile().data_connector;
    let c = configFactory.create(cf);
    assert(c, 'No config returned from create');
    commonVerifyValid(c, cf);
  });
}); // describe 1

describe('2 read YAML config file', function () {
  'use strict';

  it('2.1 should verify and return config if all props are valid', function () {

    let yamlConfig = fs.readFileSync(__dirname + '/' + './test-data/config_test1.yaml').toString(); //console.log(yamlConfig);

    let cf = yaml.safeLoad(yamlConfig); // create own copy so can checks that fields were set correctly
    //console.log('safeload yaml', cf);

    let c = configFactory.createFromYAML(yamlConfig, 'service_1');
    assert(c, 'No config returned from create');
    console.log(c);

    commonVerifyValid(c, cf.service_1);
  });
}); // describe 2

//
// HELPER UTILS
//

function commonVerifyValid(c, cf) {
  'use strict';

  assert(c, 'No config returned from create');

  c.should.have.property('DOMAIN_NAME', cf.DOMAIN_NAME);
  c.should.have.property('LISTEN_PORT', cf.LISTEN_PORT);
  c.should.have.property('LISTEN_PORT_INSIDE_DOCKER', cf.LISTEN_PORT_INSIDE_DOCKER);

  c.should.have.property('API_GATEWAY_URL', cf.api_gateway.url);
  c.should.have.property('WEBSHIELD_API_KEY', cf.api_gateway.webshield_api_key);

  c.should.have.property('is');
  c.is.should.have.property('post_subject_url', 'post_subject_url');
  c.is.should.have.property('post_subject_query_url', 'post_subject_query_url');

  c.should.have.property('terminate_tls');
  c.terminate_tls.should.have.property('enabled', true);
  c.terminate_tls.should.have.property('certificate_file', cf.terminate_tls.certificate_file);
  c.terminate_tls.should.have.property('private_key_file', cf.terminate_tls.private_key_file);
  c.should.have.property('PROTOCOL', 'https');

  c.should.have.property('SKIP_STARTUP_CREATE_METADATA', '0');
  c.should.have.property('metadata');
  c.metadata.should.have.property('file', cf.metadata.file);
  c.metadata.should.have.property('skip_startup_create', false);

  c.should.have.property('crypto');
  c.crypto.should.have.property('jwt');
  c.crypto.jwt.should.have.property('issuer', cf.DOMAIN_NAME);
  c.crypto.jwt.should.have.property('type', cf.jwt.signer.alg);
  c.crypto.jwt.should.have.property('x509Cert', '3\n');
  c.crypto.jwt.should.have.property('publicKey', '4\n');
  c.crypto.jwt.should.have.property('secret', '5\n');
  c.should.have.property('VERIFY_JWT', true);
}
