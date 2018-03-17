'use strict'

const ssri = require('ssri')

const { findDepVersion } = require('./traverse')

function flattenPackageLock (deps, flattenedTree) {
  flattenedTree = flattenedTree || {}
  return Object.keys(deps).reduce((flattenedTree, depName) => {
    const { version, dependencies } = deps[depName]
    if (!deps[depName].bundled) {
      const resolved = deps[depName].resolved || version
      // https://docs.npmjs.com/files/package-lock.json#version-1
      flattenedTree[`${depName}@${version}`] = Object.assign({}, deps[depName], {resolved})
    }
    if (dependencies) flattenPackageLock(dependencies, flattenedTree)
    return flattenedTree
  }, flattenedTree)
}

module.exports = {
  flattenPackageLock,
  mergeDepsToYarnTree (deps, path, nodeModulesTree, tree) {
    return Object.keys(deps).reduce((tree, dep) => {
      const depSemver = deps[dep]
      try {
        const depVersion = findDepVersion(dep, nodeModulesTree, path)
        const existingPackage = tree[dep] || {}
        const existingPackageVersion = tree[dep] && tree[dep][depVersion]
          ? tree[dep][depVersion]
          : {}
        const existingSemvers = tree[dep] &&
          tree[dep][depVersion] &&
          tree[dep][depVersion].semvers
        tree[dep] = Object.assign({}, existingPackage, {
          [depVersion]: Object.assign({},
            existingPackageVersion,
            {
              semvers: existingSemvers
                ? existingSemvers.add(depSemver)
                : new Set([depSemver])
            }
          )
        })
        return tree
      } catch (e) {
        // non-existent package (eg. fsevents)
        return tree
      }
    }, tree)
  },
  formatYarnResolved (resolved, integrity) {
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
