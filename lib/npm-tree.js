'use strict'

const { stringManifestFetcher } = require('./manifest-fetcher')

function npmTree ({yarnObject, manifest, parent = {}}) {
  const self = Object.freeze({addEntry, toObject, getAncestor, getRootNode, getVersion})
  const state = {
    version: manifest.version,
    resolved: manifest._resolved,
    integrity: manifest._integrity,
    requires: Object.keys(manifest.dependencies).reduce((requires, depName) => {
      const depSemver = manifest.dependencies[depName]
      if (!yarnObject[`${depName}@${depSemver}`]) return requires // fsevents, etc. TODO: fix this
      const { version } = yarnObject[`${depName}@${depSemver}`]
      requires[depName] = version
      return requires
    }, {}),
    getManifest: parent.manifestFetcher || stringManifestFetcher(),
    dependencies: {}
  }
  function getAncestor (depName) {
    return state.dependencies[depName] ||
      (typeof parent.getAncestor === 'function'
      ? parent.getAncestor(depName)
      : null)
  }
  function getRootNode () {
    if (parent && parent.getRootNode) return parent.getRootNode()
    return self
  }
  function getVersion () {
    return state.version
  }
  async function addEntry (entryName, entryVersion) {
    const entryInTree = self.getAncestor(entryName)
    if (entryInTree) {
      if (entryInTree.getVersion() === entryVersion) return
      const entryManifest = await state.getManifest(`${entryName}@${entryVersion}`)
      state.dependencies[entryName] = npmTree({yarnObject, manifest: entryManifest, parent: self})
      return Promise.all(
        Object.keys(entryManifest.dependencies).map(depName => {
          const depSemver = entryManifest.dependencies[depName]
          const { version } = yarnObject[`${depName}@${depSemver}`]
          return state.dependencies[entryName].addEntry(
            depName,
            version
          )
        })
      )
    } else if (!parent.getRootNode) { // this is the root node
      const entryManifest = await state.getManifest(`${entryName}@${entryVersion}`)
      state.dependencies[entryName] = npmTree({yarnObject, manifest: entryManifest, parent: self})
      return Promise.all(
        Object.keys(entryManifest.dependencies).map(depName => {
          const depSemver = entryManifest.dependencies[depName]
          if (!yarnObject[`${depName}@${depSemver}`]) return // fsevents, etc. TODO: fix this
          const { version } = yarnObject[`${depName}@${depSemver}`]
          return state.dependencies[entryName].addEntry(
            depName,
            version
          )
        })
      )
    } else {
      const rootNode = getRootNode()
      return rootNode.addEntry(entryName, entryVersion)
    }
  }
  function toObject () {
    return {
      version: state.version,
      resolved: state.resolved,
      integrity: state.integrity,
      requires: Object.keys(state.requires).length > 0 ? state.requires : undefined,
      dependencies: Object.keys(state.dependencies).length > 0
        ? Object.keys(state.dependencies).reduce((dependencies, depName) => {
          dependencies[depName] = state.dependencies[depName].toObject()
          return dependencies
        }, {})
        : undefined
    }
  }
  return self
}

module.exports = {npmTree}
