/*jslint node: true, vars: true */

const assert = require('assert');
const util = require('util');

//
// Verfiy the configuration file stucture is valid
// See example.config.yaml for what can be passed
function verify(config) {
  'use strict';

  assert(config, 'no config parameter passed in');

  if (config.terminate_tls.enabled) {
    assert(config.terminate_tls.certificate_file, util.format('No config.terminate_tls.certificate_file property cannot configure:%j', config));
    assert(config.terminate_tls.private_key_file, util.format('No config.terminate_tls.private_key_file property cannot configure:%j', config));
  }

  // Ensure the jwt configuration
  assert(config.jwt, util.format('No config.jwt property cannot configure signing and verifying JWTs:%j', config));
  assert(config.jwt.signer, util.format('No config.jwt.signer property cannot configure signing JWTs:%j', config));

  let signer = config.jwt.signer;
  switch (signer.alg) {

    case 'HS256': {
      assert(signer.HS256, util.format('No config.jwt.signer.HS256 property cannot configure signing JWTs:%j', config));
      break;
    }

    case 'RS256': {
      assert(signer.RS256, util.format('No config.jwt.signer.RS256 property cannot configure signing JWTs:%j', config));
      assert(signer.RS256.certificate_file, util.format('No config.jwt.signer.RS256.certificate_file property cannot configure signing JWTs:%j', config));
      assert(signer.RS256.public_key_file, util.format('No config.jwt.signer.RS256.public_key_file property cannot configure signing JWTs:%j', config));
      assert(signer.RS256.private_key_file, util.format('No config.jwt.signer.RS256.private_key_file property cannot configure signing JWTs:%j', config));
      break;
    }

    default: {
      assert(false, util.format('unknown jwt siging type'));
    }
  }
}

module.exports = {
  verify: verify,
};
