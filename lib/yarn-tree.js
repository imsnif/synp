'use strict'

const { formatYarnResolved } = require('../util/format')

function emptyEntry () {
  return {semvers: [], data: null, name: null}
}

function addManifestSemvers (manifestDeps, nodeDeps, entries) {
  Object.keys(manifestDeps).forEach(depName => {
    const key = `${depName}@${nodeDeps.get(depName).version}`
    const semverString = manifestDeps[depName]
    const entry = entries.get(key) || emptyEntry()
    entry.semvers.push(semverString)
    entries.set(key, entry)
  })
}

function createEntry (key, manifest, node, entries) {
  const entry = entries.get(key) || emptyEntry()
  const resolved = manifest.resolved || manifest._resolved
  const shasum = manifest._shasum
  entry.name = manifest.name
  entry.data = {
    version: manifest.version,
    dependencies: Object.keys(manifest.dependencies).length > 0
      ? manifest.dependencies
      : null,
    optionalDependencies: Object.keys(manifest.optionalDependencies).length > 0
      ? manifest.optionalDependencies
      : null,
    resolved: formatYarnResolved(resolved, shasum)
  }
  return entry
}

module.exports = {
  createYarnTree ({logicalTree}) {
    let entries = new Map()
    logicalTree.forEach((node, cb) => {
      const manifest = node.manifest
      const key = `${node.name}@${node.version}`
      const entry = createEntry(key, manifest, node, entries)
      addManifestSemvers(manifest.dependencies, node.dependencies, entries)
      if (!node.isRoot) entries.set(key, entry)
      cb()
    })
    return Array.from(entries.entries()).reduce((obj, [key, val]) => {
      const name = val.name
      const semverStrings = val.semvers
      semverStrings.forEach(s => {
        obj[`${name}@${s}`] = val.data
      })
      return obj
    }, {})
  }
}
