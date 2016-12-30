/*jslint node: true, vars: true */

const assert = require('assert');
const configVerifier = require('./verifier').verify;
const fs = require('fs');
const util = require('util');
const yaml = require('js-yaml');

//
// Create from a YAML file.  See example.config.yaml for what can be passed
//
function createFromYAML(yamlConfig, serviceName) {
  'use strict';
  assert(yamlConfig, 'no yamlConfig parameter passed in');
  assert(serviceName, 'no serviceName parameter passed in');
  let config = yaml.safeLoad(yamlConfig);
  assert(config, util.format('No config from YAML config file:%s', yamlConfig));

  let serviceConfig = config[serviceName];
  assert(serviceConfig, util.format('No service config for service:%s: in config:%j', serviceName, config));

  return create(serviceConfig);
}

//
// Create from a JSON version of the YAML config file
function create(config) {
  'use strict';

  configVerifier(config);

  let c = {};

  // by default do not use unless an environmental to override.
  // historic.
  c.LOG_ENTRIES = false;

  // the domain name in the config file can be overriden by an
  // env.
  if (process.env.DOMAIN_NAME) {
    c.DOMAIN_NAME = process.env.DOMAIN_NAME;
  } else if (config.DOMAIN_NAME) {
    c.DOMAIN_NAME = config.DOMAIN_NAME;
  }

  // VERSION NUMBER IS BAKED INTO DOCKER IMAGE AS AN ENV.
  c.VERSION_NUMBER = 'not-set';
  if (process.env.VERSION_NUMBER) {
    c.VERSION_NUMBER = process.env.VERSION_NUMBER;
  }

  // HOSTNAME IS PASSED IN AS A Process Env.
  c.HOSTNAME = 'localhost';
  if (process.env.HOSTNAME) {
    c.HOSTNAME = process.env.HOSTNAME;
  }

  // LISTEN_PORT can be overriden by env
  c.LISTEN_PORT = 8080;
  if (process.env.LISTEN_PORT) {
    c.LISTEN_PORT = process.env.LISTEN_PORT;
  } else if (config.LISTEN_PORT) {
    c.LISTEN_PORT = config.LISTEN_PORT;
  }

  c.LISTEN_PORT_INSIDE_DOCKER = 8080;
  if (process.env.LISTEN_PORT_INSIDE_DOCKER) {
    c.LISTEN_PORT_INSIDE_DOCKER = process.env.LISTEN_PORT_INSIDE_DOCKER;
  } else if (config.LISTEN_PORT_INSIDE_DOCKER) {
    c.LISTEN_PORT_INSIDE_DOCKER = config.LISTEN_PORT_INSIDE_DOCKER;
  }

  //
  // TLS - copy over as is
  //
  c.terminate_tls = {};
  c.terminate_tls.enabled = false;
  if (config.terminate_tls.enabled) {
    c.terminate_tls.enabled = true;
    c.terminate_tls.certificate_file = config.terminate_tls.certificate_file;
    c.terminate_tls.private_key_file = config.terminate_tls.private_key_file;
  }

  c.PROTOCOL = 'http';
  if ((config.terminate_tls) && (config.terminate_tls.enabled)) {
    c.PROTOCOL = 'https';
  }

  //
  // ADD ANY PRIVACY AGENT CONFIGURATION
  //
  if (config.privacy_agent) {
    c.privacy_agent = {};
    c.privacy_agent.id = config.privacy_agent.id;
  }

  //----------
  // METADATA
  //-----------

  /*
     Setup the metadata parameters, they are both at the top level props and
     inside the metadata object. The file values can be overridden by envs at
     runtime.
  */

  c.metadata = {};
  c.SKIP_STARTUP_CREATE_METADATA = '0';
  c.metadata.skip_startup_create = false;
  if (process.env.SKIP_STARTUP_CREATE_METADATA) {
    c.SKIP_STARTUP_CREATE_METADATA = process.env.SKIP_STARTUP_CREATE_METADATA;
    if (c.SKIP_STARTUP_CREATE_METADATA === '1') {
      c.metadata.skip_startup_create = true;
    }
  } else if (config.metadata.skip_startup_create) {
    c.SKIP_STARTUP_CREATE_METADATA = '1';
    c.metadata.skip_startup_create = config.metadata.skip_startup_create;
  }

  if (process.env.METADATA_FILE) {
    c.metadata.file = process.env.METADATA_FILE;
  } else if (config.metadata.file) {
    c.metadata.file = config.metadata.file;
  }

  /*
     setup API GATEWAY URL and KE, they are both at the top level props and
     inside the metadata object. The file values can be overridden by envs at
     runtime.
  */

  c.api_gateway = { url: null, webshield_api_key: null };
  c.API_GATEWAY_URL = null;
  c.WEBSHIELD_API_KEY = null;

  if (process.env.API_GATEWAY_URL) {
    c.API_GATEWAY_URL = process.env.API_GATEWAY_URL;
    c.api_gateway.url = c.API_GATEWAY_URL;
  } else if (config.api_gateway.url) {
    c.API_GATEWAY_URL = config.api_gateway.url;
    c.api_gateway.url = c.API_GATEWAY_URL;
  }

  if (process.env.WEBSHIELD_API_KEY) {
    c.WEBSHIELD_API_KEY = process.env.WEBSHIELD_API_KEY;
    c.api_gateway.webshield_api_key = c.WEBSHIELD_API_KEY;
  } else if (config.api_gateway.webshield_api_key) {
    c.WEBSHIELD_API_KEY = config.api_gateway.webshield_api_key;
    c.api_gateway.webshield_api_key = c.WEBSHIELD_API_KEY;
  }

  //
  // JWT CONFIG
  //
  let signer = config.jwt.signer;
  switch (signer.alg) {

    case 'HS256': {
      c.crypto = {};
      c.crypto.jwt = {};
      c.crypto.jwt.issuer = c.DOMAIN_NAME;
      c.crypto.jwt.type = 'HS256';

      let secret = signer.HS256.secret;
      if (process.env.JWT_SECRET) {
        secret = process.env.JWT_SECRET;
      }

      assert(secret, util.format('No config.jwt.signer.HS256.secret or JWT_SECRET property cannot configure signing JWTs:%j', config));
      c.crypto.jwt.secret = secret;
      break;
    }

    case 'RS256': {
      c.crypto = {};
      c.crypto.jwt = {};
      c.crypto.jwt.issuer = c.DOMAIN_NAME;
      c.crypto.jwt.type = 'RS256';

      // the certficate file
      let x509CertPEM = readfile(signer.RS256.certificate_file);
      assert(x509CertPEM, util.format('No certificate_file configure signing JWTs:%j', config));
      c.crypto.jwt.x509CertPEM = x509CertPEM;

      // the public key file
      let publicKeyPEM = readfile(signer.RS256.public_key_file);
      assert(publicKeyPEM, util.format('No public_key_file configure signing JWTs:%j', config));
      c.crypto.jwt.publicKeyPEM = publicKeyPEM;

      // the rsa private key
      let rsaPrivateKey = readfile(signer.RS256.private_key_file);
      assert(rsaPrivateKey, util.format('No private_key_file configure signing JWTs:%j', config));
      c.crypto.jwt.privateKey = rsaPrivateKey;
      break;
    }

    default: {
      assert(false, util.format('unknown jwt siging type'));
    }
  }

  if (config.jwt.verifier) {
    if (config.jwt.verifier.enabled) {
      c.VERIFY_JWT = true;
    } else {
      c.VERIFY_JWT = false;
    }

    // The old code expects to be able to verify HS256 signatures with a
    // secret that is shared by all parties. This is of course stupid but a
    // throwback to prototype and not had a chance to remove as move to rs256
    // keys. So services need to be able to verify. For now support by adding
    // the secret key in the verifier
    //
    // if the secret is there then no need to do anything as using HS256 to sign
    // and all just works  FIXME CODE NEEDS SECRET
    if (!c.crypto.jwt.secret) {
      if (process.env.JWT_SECRET) {
        c.crypto.jwt.secret = process.env.JWT_SECRET;
      } else if ((config.jwt.verifier.HS256) && (config.jwt.verifier.HS256.secret)) {
        c.crypto.jwt.secret = config.jwt.verifier.HS256.secret;
      }
    }
  }

  // allow verify to be overrriden by env
  if (process.env.VERIFY_JWT) {
    if (process.env.VERIFY_JWT.toLowerCase() === 'false') {
      c.VERIFY_JWT = false;
    } else {
      c.VERIFY_JWT = true;
    }
  }

  c.getHost = function getHost() {
    return c.PROTOCOL + '://' + c.getHostnameWithPort(c);
  };

  c.getHostname = function getHostname() {
    return c.HOSTNAME;
  };

  c.getHostnameWithPort = function getHostnameWithPort(c) {
    return c.HOSTNAME + ':' + 'c.LISTEN_PORT';
  };

  //
  // Finally record the passed in config file
  //
  c.PASSED_IN_CONFIG_FILE = config;

  return c;
}

// convenice routine for reading file
function readfile(path) {
  'use strict';
  return fs.readFileSync(__dirname + '/' + path).toString();
}

module.exports = {
  create: create,
  createFromYAML: createFromYAML,
};
