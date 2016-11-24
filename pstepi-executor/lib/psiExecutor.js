/*jslint node: true, vars: true */

/*

The Privacy Step executor applies any contained Privacy Actions to the passed in
@graph of data. In this process it may invoke KMS and Obfuscation Services.

The key is designed to be shared across all Privacy Agents, this covers the
 - Ingest Privacy Agent
 - Reference Source Privacy Agent
 - Query Privacy Agent

Inputs:
 - serviceCtx that
 - graph to obfuscate
 - Privacy Step Instance to apply

 Output:
  - Cloned graph containing obfuscated data.

Assumptions
 - only one privacy action supported for now
 - the input graph is JSONLD expanded.

EXECUTION

Each Privacy Action acts as follows

Using the privacy action JSON Schema (version 4)

For each input node in the graph that has an @type that matches the JSON Schema top level
title perform the following:
1. create a new node copiying the @id and @type from the source node
2. process the http://json-schema.org/properties as follows
2.1. If property is a value
2.1.1. If the source node contains the property then
2.1.1.1 Obfuscate the value, and add property with obfuscated value to new node.
2.1.1.1. Handle @value, etc
2.1.1.1. Handle any need to add IV, nonce, or AAD
2.2. If property is an object
2.2.1 create a new node for the property, and process as follows
2.2.1 if source node has an @id then copy the @id property to the new node
2.2.2 if source node has an @type then copy the @type property to the new node
2.2.3 process the http://json-schema.org/properties

For reference here is an example JSON schema so can apply above algorithm to


{
	"$schema": "http://json-schema.org/draft-04/schema#",
	"id": "http://subject.pn.schema.webshield.io",
  "definitions": {
   "https://schema.org/PostalAddress": {
     "type": "object",
     "title": "http://schema.org/PostalAddress",
     "properties": {
        "@type": { "type": "array"},
       "https://schema.org/addressCountry":     { "type": "string" },
       "https://schema.org/addressLocality":    { "type": "string" },
       "https://schema.org/addressRegion":      { "type": "string" },
       "https://schema.org/postalCode":         { "type": "string" },
       "https://schema.org/postOfficeBoxNumber":{ "type": "string" },
       "https://schema.org/streetAddress":      { "type": "string" }
     },
     "required": ["@type"]
   }
 },
	"title": "http://pn.schema.webshield.io/type#Subject",
	"type": "object",
	"properties": {
		"@id":        { "type": "string" },
		"@type":      { "type": "array" },
		"https://schema.org/deathDate":                  { "type": "string" },
		"https://schema.org/birthDate":                 { "type": "string" },
		"https://schema.org/email":                     { "type": "string" },
		"https://schema.org/telephone":                 { "type": "string" },
		"https://schema.org/gender":                    { "type": "string" },
		"https://schema.org/givenName":                 { "type": "string" },
		"https://schema.org/familyName":                { "type": "string" },
		"https://schema.org/additionalName":            { "type": "string" },
    "https://schema.org/taxID":                     { "type": "string" },
    "http://pn.schema.webshield.io/prop#taxID":     { "type": "string" },
		"http://pn.schema.webshield.io/prop#sourceID":  { "type": "string" },
		"http://schema.org/address": { "$ref": "#/definitions/https://schema.org/PostalAddress" }
  },
  "required": [ "@id", "@type", "http://pn.schema.webshield.io/prop#sourceID"]
}

*/

let promises = {};
let callbacks = {};

module.exports = {
  callbacks: callbacks,
  promises: promises,
};
