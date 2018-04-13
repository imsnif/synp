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
  manifestFetcher (packageDir, log) {
    const queue = new Queue(10, Infinity)
    // queue limit is intentionally left hard-coded to avoid spamming repositories
    return (name, version) => {
      const versionForPacote = version.replace(/^file:/, `file:${packageDir}/`)
      const pkgString = `${name}@${versionForPacote}`
      log(`Fetching manifest for ${name}@${version}`)
      return getManifest(pkgString, queue)
    }
  }
}
