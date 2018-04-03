'use strict'

const {
  formatYarnResolved,
  formatDependenciesForYarn
} = require('../util/format')

module.exports = {
  yarnEntry () {
    let semvers = []
    let node = {}
    let state = {}
    let name = null
    let integrity = null
    let shasum = null
    return Object.freeze({
      set integrity (val) { integrity = val },
      set shasum (val) { shasum = val },
      set node (val) { node = val },
      set name (val) { name = val },
      get name () { return name },
      set version (val) { state.version = val },
      set resolved (val) {
        state.resolved = formatYarnResolved(val, shasum)
      },
      get semvers () { return semvers },
      set dependencies (val) {
        const {
          yarnDeps,
          yarnOptionalDeps
        } = formatDependenciesForYarn(val, node.dependencies)
        state.dependencies = Object.keys(yarnDeps).length > 0
          ? yarnDeps : null
        state.optionalDependencies = Object.keys(yarnOptionalDeps).length > 0
          ? yarnOptionalDeps : null
      },
      toObject () {
        return state
      }
    })
  }
}
