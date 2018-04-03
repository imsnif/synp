'use strict'

module.exports = {
  formatYarnResolved (resolved, shasum) {
    if (/^git/.test(resolved)) return resolved
    // github urls use their branch checksum
    return `${resolved}#${shasum}`
  },
  formatDependenciesForYarn (manifestDependencies, nodeDependencies) {
    return Object.keys(manifestDependencies)
      .reduce(({deps, optDeps}, depName) => {
        const depLogicalEntry = nodeDependencies.get(depName)
        const depSemver = manifestDependencies[depName]
        if (!depLogicalEntry) return {yarnDeps, yarnOptionalDeps}
        // not in package-lock, ignore it
        if (depLogicalEntry.optional === true) {
          optDeps[depName] = depSemver
        } else {
          deps[depName] = depSemver
        }
        return {deps, optDeps}
      }, {deps: {}, optDeps: {}})
  }
}
