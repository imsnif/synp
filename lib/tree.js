'use strict'

const path = require('path')

const { getParentPackageInYarnTree } = require('../util/traverse')
const { npmEntry } = require('./entry')
const { splitPathToModules } = require('../util/traverse')

module.exports = {
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
