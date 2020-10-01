'use strict'

const { sep, resolve } = require('path')
const { has } = require('lodash')
const sortObject = require('sort-object-keys')
const { dependenciesForYarn } = require('./dependencies')
const { yarnEntry, npmEntry } = require('./entry')
const { npmEntryFromWorkspace } = require('../lockfileV2/workspace')

const {
  splitPathToModules,
  parentPackagePath,
  getParentPackageInYarnTree
} = require('../../util/traverse')

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
  buildNpmTree (nodeModulesTree, yarnObject, workspacesTree) {
    const countDepth = (path) => path.split(`${sep}node_modules${sep}`).length - 1
    const sortedNodeModules = Object.keys(nodeModulesTree).sort((a, b) => countDepth(a) < countDepth(b) ? -1 : 1)
    const basePath = sortedNodeModules[0].split(sep)

    return sortObject(sortedNodeModules.slice(1)
      .reduce((tree, mPath) => {
        const relativePath = mPath.split(sep).slice(basePath.length)
        const modulesInPath = splitPathToModules(relativePath)
        const { name, dependencies } = nodeModulesTree[mPath]
        const entry = npmEntry(nodeModulesTree, yarnObject, mPath) || npmEntryFromWorkspace(workspacesTree, name, modulesInPath, resolve(basePath.join(sep)).split(sep))

        if (!entry) {
          return tree
        }

        if (!has(nodeModulesTree[parentPackagePath(mPath)], `dependencies.${name}`)) {
          entry.dev = true
        }

        if (workspacesTree && dependencies) {
          entry.requires = sortObject(dependencies)
        }

        if (modulesInPath.length > 1) {
          const parentPackage = getParentPackageInYarnTree(modulesInPath, tree)

          parentPackage.dependencies = sortObject(Object.assign({}, parentPackage.dependencies, {
            [name]: entry
          }))

          if (parentPackage.dev) {
            entry.dev = true
          }
        } else {
          tree[name] = entry
        }

        return tree
      }, {}))
  }
}
