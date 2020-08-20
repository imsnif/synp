'use strict'

const { sep, resolve } = require('path')
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
    const sortedNodeModules = Object.keys(nodeModulesTree)
      .sort((a, b) => a.split(sep).length < b.split(sep).length ? -1 : 1)
    const basePath = sortedNodeModules[0].split(sep)

    return sortedNodeModules.slice(1)
      .reduce((tree, mPath) => {
        const relativePath = mPath.split(sep).slice(basePath.length)
        const modulesInPath = splitPathToModules(relativePath)
        const { name, dependencies } = nodeModulesTree[mPath]
        const entry = npmEntry(nodeModulesTree, yarnObject, mPath) || npmEntryFromWorkspace(workspacesTree, name, modulesInPath, resolve(basePath.join(sep)).split(sep))

        if (!entry) {
          return tree
        }

        if (workspacesTree && dependencies) {
          entry.requires = dependencies
        }

        if ((nodeModulesTree[parentPackagePath(mPath)].devDependencies || {})[name]) {
          entry.dev = true
        }

        if (modulesInPath.length > 1) {
          const parentPackage = getParentPackageInYarnTree(modulesInPath, tree)
          parentPackage.dependencies = Object.assign({}, parentPackage.dependencies || {}, {
            [name]: entry
          })

          if (parentPackage.dev) {
            entry.dev = true
          }
        } else {
          tree[name] = entry
        }

        return tree
      }, {})
  }
}
