'use strict'

const nock = require('nock')
const stubs = require('./stubs.json')

const registryUrl = 'https://registry.npmjs.org' // TODO: not hard-coded

module.exports = {
  stubs () {
    Object.keys(stubs).forEach(uri => {
      const body = JSON.stringify(stubs[uri])
      nock(registryUrl, {allowUnmocked: true})
      .get(uri)
      .reply(200, body)
      .persist()
    })
  }
}
