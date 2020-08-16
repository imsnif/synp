'use strict'

const path = require('path')

const { getParentPackageInYarnTree } = require('../../util/traverse')
const { dependenciesForYarn } = require('./dependencies')
const { yarnEntry, npmEntry } = require('./entry')
const { splitPathToModules } = require('../../util/traverse')
const {
  flattenPackageLock,
  mergeDepsToYarnTree,
  formatYarnTree
} = require('../../util/format')

module.exports = {
  buildYarnTree (nodeModulesTree, packageLock) {
    const flattenedPackageLock = flattenPackageLock(packageLock.dependencies)
    const tree = Object.keys(nodeModulesTree).reduce((tree, path) => {
      const nmEntry = nodeModulesTree[path]
      const { name } = nmEntry
      const allDeps = dependenciesForYarn(nmEntry, packageLock)
      if (name !== packageLock.name) {
        const entry = yarnEntry(nmEntry, allDeps, flattenedPackageLock, tree)
        if (entry) {
          tree[name] = entry
        }
      }
      const deps = Object.assign({},
        allDeps.dependencies,
        allDeps.optionalDependencies,
        allDeps.devDependencies
      )
      const treeWithDeps = mergeDepsToYarnTree(deps, path, nodeModulesTree, tree)
      return treeWithDeps
    }, {})
    const formattedTree = formatYarnTree(tree)
    return formattedTree
  },
  buildNpmTree (nodeModulesTree, yarnObject, isV2) {
    const sortedNodeModules = Object.keys(nodeModulesTree)
      .sort((a, b) => a.split(path.sep).length < b.split(path.sep).length ? -1 : 1)
    const basePath = sortedNodeModules[0].split(path.sep)

    return sortedNodeModules.slice(1)
      .reduce((tree, mPath) => {
        const relativePath = mPath.split(path.sep).slice(basePath.length)
        const modulesInPath = splitPathToModules(relativePath)
        const { name, dependencies } = nodeModulesTree[mPath]
        const entry = npmEntry(nodeModulesTree, yarnObject, mPath) || isV2 && modulesInPath.length ===1 && {
          version: `file:packages/${name}`
        }

        if (!entry) {
          return tree
        }

        if (isV2 && dependencies) {
          entry.requires = dependencies
        }

        if (modulesInPath.length > 1) {
          const parentPackage = getParentPackageInYarnTree(modulesInPath, tree)
          parentPackage.dependencies = Object.assign({}, parentPackage.dependencies || {}, {
            [name]: entry
          })

        } else {
          tree[name] = entry
        }

        return tree
      }, {})
  }
}
