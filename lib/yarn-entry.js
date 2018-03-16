'use strict'

const ssri = require('ssri')

function normalizeResolved (resolved, integrity) {
  const hexChecksum = ssri.parse(integrity).hexDigest()
  return `${resolved}#${hexChecksum}`
}

function formatYarnDependencies (manifestDependencies, nodeDependencies) {
  return Object.keys(manifestDependencies)
    .reduce(({yarnDeps, yarnOptionalDeps}, depName) => {
      const depLogicalEntry = nodeDependencies.get(depName)
      const depSemver = manifestDependencies[depName]
      if (!depLogicalEntry) return {yarnDeps, yarnOptionalDeps}
      // not in package-lock, ignore it
      if (depLogicalEntry.optional === true) {
        yarnOptionalDeps[depName] = depSemver
      } else {
        yarnDeps[depName] = depSemver
      }
      return {yarnDeps, yarnOptionalDeps}
    }, {yarnDeps: {}, yarnOptionalDeps: {}})
}

module.exports = {
  yarnEntry () {
    let semvers = []
    let node = {}
    let state = {}
    let name = null
    let integrity = null
    function _isPopulated (key) {
      return state[key] && Object.keys(state[key]).length > 0
    }
    return Object.freeze({
      set integrity (val) { integrity = val },
      get integrity () { return integrity },
      set node (val) { node = val },
      set name (val) { name = val },
      get name () { return name },
      set version (val) { state.version = val },
      set resolved (val) {
        state.resolved = normalizeResolved(val, integrity)
      },
      get semvers () { return semvers },
      set dependencies (val) {
        const { yarnDeps, yarnOptionalDeps } = formatYarnDependencies(val, node.dependencies)
        state.dependencies = yarnDeps
        state.optionalDependencies = yarnOptionalDeps
      },
      toObject () {
        return Object.assign({}, state, {
          dependencies: _isPopulated('dependencies')
            ? state.dependencies
            : null,
          optionalDependencies: _isPopulated('optionalDependencies')
            ? state.optionalDependencies
            : null
        })
      }
    })
  }
}
