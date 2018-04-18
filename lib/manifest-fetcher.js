'use strict'

const os = require('os')
const Queue = require('promise-queue')
const pacote = require('pacote')
const semver = require('semver')

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
      // below is an ugly hack until https://github.com/zkat/pacote/pull/149
      // is merged or addressed
      const versionForPacote = /\.tgz$/.test(version)
        ? semver.coerce(version).version
        : version.replace(/^file:/, `file:${packageDir}/`)
      const pkgString = `${name}@${versionForPacote}`
      log(`Fetching manifest for ${name}@${version}`)
      return getManifest(pkgString, queue)
    }
  }
}
