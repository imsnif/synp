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
  exposePhysicalNode (state) {
    return {
      get parent () {
        return state.parent
      },
      get children () {
        return state.children
      },
      get logicalNode () {
        return state.logicalNode
      },
      get unlinked () {
        if (state.parent) return state.unlinked || state.parent.unlinked
        return state.unlinked
      },
      get optional () {
        if (state.parent) return state.optional || state.parent.optional
        return state.optional
      },
      get dev () {
        if (state.parent) return state.dev || state.parent.dev
        return state.dev
      },
      get bundledTo () {
        return state.bundledTo
      },
      get bundled () {
        return !!(state.bundledTo)
      }
    }
  }
}
