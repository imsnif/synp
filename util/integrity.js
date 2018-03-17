'use strict'

const ssri = require('ssri')
const rp = require('request-promise')

module.exports = {
  async getSha1Integrity (integrity, resolved, manifest) {
    // for yarn.lock backwards compatibility
    if (!/^sha1-/.test(integrity)) {
      const file = await rp({
        url: resolved,
        encoding: null
      })
      const integrity = ssri.create({algorithms: ['sha1']}).update(file)
      return integrity.digest().toString()
    } else {
      return integrity
    }
  }
}
