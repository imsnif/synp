'use strict'

module.exports = {
  exposeManifest (manifest) {
    return {
      get manifest () {
        return manifest
      },
      get name () {
        return manifest.name
      },
      get version () {
        return manifest.version
      },
      get bin () {
        return manifest.bin
      },
      get optionalDependencies () {
        return manifest.optionalDependencies || {}
      },
      get bundleDependencies () {
        return manifest.bundleDependencies || []
      },
      get devDependencies () {
        return manifest.devDependencies || []
      }
    }
  },
  exposePhysicalNode (state, parent) {
    return {
      get parent () {
        return parent
      },
      get children () {
        return state.children
      },
      get logicalNode () {
        return state.logicalNode
      },
      get unlinked () {
        if (parent) return state.unlinked || parent.unlinked
        return state.unlinked
      },
      get optional () {
        if (parent) return state.optional || parent.optional
        return state.optional
      },
      get dev () {
        if (parent) return state.dev || parent.dev
        return state.dev
      },
      get bundled () {
        if (parent) return state.bundled || parent.bundled
        return state.bundled
      }
    }
  }
}
