'use strict'

const jsonStringify = require('json-stable-stringify')

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
  },
  stringifyPackageLock ({packageLock, packageJson}) {
    const { name, version } = packageJson
    const keyPriorities = {
      name: 1,
      version: 2,
      resolved: 3,
      integrity: 4,
      bundled: 5,
      optional: 6,
      lockfileVersion: 7,
      requires: 8,
      dependencies: 9
    }
    return jsonStringify(Object.assign({}, packageLock, {
      name,
      version,
      lockfileVersion: 1,
      requires: true
    }), {
      space: 2,
      cmp: (a, b) => {
        const aPriority = keyPriorities[a.key]
        const bPriority = keyPriorities[b.key]
        if (aPriority && bPriority) {
          return aPriority < bPriority ? -1 : 1
        } else {
          return a.key < b.key ? -1 : 1
        }
      }
    })
  }
}
