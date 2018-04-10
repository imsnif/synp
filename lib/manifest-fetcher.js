'use strict'

const os = require('os')
const Queue = require('promise-queue')
const pacote = require('pacote')

function getManifest (pkgString, queue) {
  return queue.add(() => pacote.manifest(pkgString, {
    cache: os.tmpdir()
  }))
}

module.exports = {
  manifestFetcher () {
    const queue = new Queue(10, Infinity)
    // queue limit is intentionally left hard-coded to avoid spamming repositories
    return (pkgString) => getManifest(pkgString, queue)
  }
}
