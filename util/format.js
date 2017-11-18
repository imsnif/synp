'use strict'

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

function extractVersion (urlOrVersion, packageName) {
  // http://<registry-url>/package-name/-/package-name-<version-number>.tgz
  const re = new RegExp(`${packageName}/-/${packageName}-(.+?).tgz$`)
  const matches = urlOrVersion.match(re)
  if (matches && matches[1]) return matches[1]
  return urlOrVersion
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
  formatYarnTree (yarnTree) {
    return Object.keys(yarnTree).reduce((formatted, packageName) => {
      const entry = yarnTree[packageName]
      Object.keys(entry).forEach(version => {
        const { semvers } = entry[version]
        const nonUrlVersion = extractVersion(version, packageName)
        semvers.forEach(sver => {
          if (!entry[version].resolved && !/^http/.test(version)) {
            return
            // we cannot guess about this dependency - it is likely bundled
            // might consider adding a warning
          }
          formatted[`${packageName}@${sver}`] = Object.assign({}, entry[version], {
            semvers: undefined,
            version: nonUrlVersion,
            resolved: entry[version].resolved || version
          })
        })
      })
      return formatted
    }, {})
  }
}
