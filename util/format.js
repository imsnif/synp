'use strict'

const ssri = require('ssri')

module.exports = {
  formatYarnResolved (resolved, integrity) {
    if (/^git/.test(resolved)) return resolved
    // github urls use their branch checksum
    const hexChecksum = ssri.parse(integrity).hexDigest()
    return `${resolved}#${hexChecksum}`
  },
  formatDependenciesForYarn (manifestDependencies, nodeDependencies) {
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
}
