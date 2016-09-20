Utility to read metadata definitions from a YAML file.

For each metadata entry the following occurs
1. Fetch from metadata service by @id if found is invoked the metadata fetched callback. This must return to continue.
2. If does not exist, send POST to metadata service, once complete it invokes the create metadata item callback. This must return to continue.
   - This generates a JWT that is signed by the connector and passed to the metadata service

The expected configuration params are
 - the API_GATEWAY_URL and associated credentials.
 - the BOOTUP_METADATA_FILE - the YAML file to read.

The YAML file format is as follows

version: 1
account:
  name:
vocab:
  id:
    <type specific props>
  id:
resources:
  id:
   type:
   <type specific properties>
  id:
    type:
resource_credentials:
  id:
    type:

Example resources

resources:
  id: abc.com
    type: organization
  id: reference_source_1
    type: reference source
    provision_base_url:
  id: pa1 - supply the #value auto generates the rest
    type: privacy_algorithm
    privacy_steps:
      id: 1 - supply #value auto generates rest
        privacy_actions:
          id: supply #value auto generates the rest
