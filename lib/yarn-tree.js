'use strict'

const semver = require('semver')
const rp = require('request-promise')
const ssri = require('ssri')

const md5 = require('md5')

const { yarnEntry } = require('./yarn-entry')
const { manifestFetcher } = require('./manifest-fetcher')

function normalizeVersion (node, manifest) {
  return (
    semver.valid(node.version)
      ? node.version
      : manifest.version // eg. git dependency
  )
}

async function sha1Integrity (integrity, resolved, manifest) {
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

module.exports = {
  yarnTree (nodeModulesTree, packageJson) {
    let entries = new Map()
    const getManifest = manifestFetcher(packageJson)
    function _addManifestSemvers (manifest, node) {
      Object.keys(manifest.dependencies).forEach(depName => {
        if (!node.dependencies.get(depName)) return
        // eg. fsevents TODO: fix for platform specific dependencies
        const key = md5(depName + node.dependencies.get(depName).version)
        const semverString = manifest.dependencies[depName]
        const entry = entries.get(key) || yarnEntry()
        entry.semvers.push(semverString)
        entries.set(key, entry)
      })
    }
    async function addEntry (node) {
      if (node.bundled) return
      const manifest = await getManifest(node)
      _addManifestSemvers(manifest, node)
      if (!node.address) return // root node
      const key = md5(node.name + node.version)
      const entry = entries.get(key) || yarnEntry()
      const resolved = node.resolved || manifest.resolved || manifest._resolved
      entry.node = entry.node || node
      entry.name = node.name
      entry.version = normalizeVersion(node, manifest)
      entry.dependencies = manifest.dependencies
      entry.integrity = await sha1Integrity(node.integrity, resolved, manifest)
      entry.resolved = resolved
      entries.set(key, entry)
    }
    function toObject () {
      return Array.from(entries.entries()).reduce((obj, [key, val]) => {
        if (!val.name) return obj // bundled deps
        const name = val.name
        const semverStrings = val.semvers
        semverStrings.forEach(s => {
          obj[`${name}@${s}`] = val.toObject()
        })
        return obj
      }, {})
    }
    return Object.freeze({
      addEntry,
      toObject
    })
  }
}
