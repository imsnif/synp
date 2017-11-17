'use strict'

const path = require('path')
const { findPackageInYarnLock } = require('./yarn-tools')

function npmStyleResolved (yarnResolved) {
  const resolved = yarnResolved.replace(/#.*$/, '')
  const hexChecksum = yarnResolved.replace(/^.*#/, '')
  const integrity = 'sha1-' + Buffer.from(hexChecksum, 'hex').toString('base64')
  return { resolved, integrity }
}

function buildNpmRequires (dependencies, yarnObject) {
  return Object.keys(dependencies).reduce((npmRequires, depName) => {
    const depSemver = dependencies[depName]
    const yarnEntry = yarnObject[`${depName}@${depSemver}`]
    if (!yarnEntry) return npmRequires // fsevents, etc.
    npmRequires[depName] = yarnEntry.version
    return npmRequires
  }, {})
}

function npmPackageEntry (nodeModulesTree, yarnObject, mPath) {
  const { name, version, dependencies } = nodeModulesTree[mPath]
  const yarnEntry = findPackageInYarnLock(name, version, yarnObject)
  if (!yarnEntry) return null // likely a bundled dependency
  const yarnResolved = yarnEntry.resolved
  const { resolved, integrity } = npmStyleResolved(yarnResolved)
  const entry = {
    version,
    resolved,
    integrity
  }
  if (dependencies && Object.keys(dependencies).length > 0) {
    entry.requires = buildNpmRequires(dependencies, yarnObject)
  }
  return entry
}

function splitPathToModules (relativePath) {
  return relativePath
  .filter(p => p !== 'node_modules')
  .reduce((packages, dirName, index, rPath) => {
    if (/^@/.test(dirName)) {
      packages.push(`${dirName}/${rPath[index + 1]}`)
    } else if (!(rPath[index - 1] && /^@/.test(rPath[index - 1]))) {
      packages.push(dirName)
    }
    return packages
  }, [])
}

function getParentPackage (modulesInPath, tree) {
  return modulesInPath.slice(0, -1).reduce((prev, next) => {
    if (prev && (prev[next] || (prev.dependencies && prev.dependencies[next]))) {
      return prev[next] || prev.dependencies[next]
    } else {
      return tree
    }
  }, tree)
}

module.exports = {
  buildNpmTree (nodeModulesTree, yarnObject) {
    const sortedNodeModules = Object.keys(nodeModulesTree)
    .sort((a, b) => a.split(path.sep).length < b.split(path.sep).length ? -1 : 1)
    const basePath = sortedNodeModules[0].split(path.sep)
    return sortedNodeModules.slice(1)
    .reduce((tree, mPath) => {
      const relativePath = mPath.split(path.sep).slice(basePath.length)
      const modulesInPath = splitPathToModules(relativePath)
      const npmEntry = npmPackageEntry(nodeModulesTree, yarnObject, mPath)
      if (!npmEntry) return tree
      if (modulesInPath.length > 1) {
        const parentPackage = getParentPackage(modulesInPath, tree)
        const { name } = nodeModulesTree[mPath]
        parentPackage.dependencies = Object.assign({}, parentPackage.dependencies || {}, {
          [name]: npmEntry
        })
      } else {
        const { name } = nodeModulesTree[mPath]
        tree[name] = npmEntry
      }
      return tree
    }, {})
  }
}
