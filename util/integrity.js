'use strict'

const ssri = require('ssri')
const rp = require('request-promise')
const ngu = require('normalize-git-url')

function normalizeUrl (urlString) {
  if (/^git/.test(urlString)) {
    const { url, branch } = ngu(urlString)
    return `${url}#${branch}`
  } else {
    return urlString
  }
}

module.exports = {
  async getSha1Integrity (integrity, resolved, manifest) {
    // for yarn.lock backwards compatibility
    if (!/^sha1-/.test(integrity)) {
      const url = normalizeUrl(resolved)
      const file = await rp({
        url,
        encoding: null
      })
      const integrity = ssri.create({algorithms: ['sha1']}).update(file)
      return integrity.digest().toString()
    } else {
      return integrity
    }
  }
}
