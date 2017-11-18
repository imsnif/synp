'use strict'

const path = require('path')

const { getParentPackageInYarnTree } = require('../util/traverse')
const { dependenciesForYarn } = require('./dependencies')
const { yarnEntry, npmEntry } = require('./entry')
const { splitPathToModules } = require('../util/traverse')
const {
  flattenPackageLock,
  mergeDepsToYarnTree,
  formatYarnTree
} = require('../util/format')

module.exports = {
  buildYarnTree (nodeModulesTree, packageLock) {
    const flattenedPackageLock = flattenPackageLock(packageLock.dependencies)
    const tree = Object.keys(nodeModulesTree).reduce((tree, path) => {
      const { name } = nodeModulesTree[path]
      const nmEntry = nodeModulesTree[path]
      const allDeps = dependenciesForYarn(nmEntry, packageLock)
      if (name !== packageLock.name) {
        tree[name] = yarnEntry(nmEntry, allDeps, flattenedPackageLock, tree)
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
  buildNpmTree (nodeModulesTree, yarnObject) {
    const sortedNodeModules = Object.keys(nodeModulesTree)
    .sort((a, b) => a.split(path.sep).length < b.split(path.sep).length ? -1 : 1)
    const basePath = sortedNodeModules[0].split(path.sep)
    return sortedNodeModules.slice(1)
    .reduce((tree, mPath) => {
      const relativePath = mPath.split(path.sep).slice(basePath.length)
      const modulesInPath = splitPathToModules(relativePath)
      const entry = npmEntry(nodeModulesTree, yarnObject, mPath)
      if (!entry) return tree
      if (modulesInPath.length > 1) {
        const parentPackage = getParentPackageInYarnTree(modulesInPath, tree)
        const { name } = nodeModulesTree[mPath]
        parentPackage.dependencies = Object.assign({}, parentPackage.dependencies || {}, {
          [name]: entry
        })
      } else {
        const { name } = nodeModulesTree[mPath]
        tree[name] = entry
      }
      return tree
    }, {})
  }
}
