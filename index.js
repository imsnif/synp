'use strict'

const fs = require('fs')
const path = require('path')
const lockfile = require('@yarnpkg/lockfile')
const nmTree = require('./lib/nmtree')
const { buildYarnTree, formatYarnTree } = require('./lib/yarn-tools')

function findPackageInYarnLock (name, version, yarnObject) {
  const packageKey = Object.keys(yarnObject).find(yPackage => {
    const yPackageName = yPackage.replace(/^(.+?)@.+?$/, '$1')
    return yPackageName === name && yarnObject[yPackage].version === version
  })
  return yarnObject[packageKey]
}

function npmStyleResolved (yarnResolved) {
  const resolved = yarnResolved.replace(/#.*$/, '')
  const hexChecksum = yarnResolved.replace(/^.*#/, '')
  const integrity = 'sha1-' + Buffer.from(hexChecksum, 'hex').toString('base64')
  // TODO: sha512?
  return { resolved, integrity }
}

function buildNpmRequires (dependencies, yarnObject) {
  return Object.keys(dependencies).reduce((npmRequires, depName) => {
    const depSemver = dependencies[depName]
    const yarnEntry  = yarnObject[`${depName}@${depSemver}`]
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

function buildNpmTree (nodeModulesTree, yarnObject) {
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
      const parentPackage = modulesInPath.slice(0, -1).reduce((prev, next) => {
        if (prev && (prev[next] || (prev.dependencies && prev.dependencies[next]))) {
          return prev[next] || prev.dependencies[next]
        } else {
          return tree
        }
      }, tree)
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

module.exports = {
  yarnToNpm (packageDir) {
    // TODO: error checking
    const yarnLock = fs.readFileSync(path.join(packageDir, 'yarn.lock'), 'utf-8')
    const yarnObject = lockfile.parse(yarnLock).object
    const nodeModulesTree = nmTree(packageDir)
    const dependencies = buildNpmTree(nodeModulesTree, yarnObject)
    const packageJson = fs.readFileSync(path.join(packageDir, 'package.json'))
    const { name, version } = JSON.parse(packageJson)
    return JSON.stringify({
      name,
      version,
      lockfileVersion: 1,
      requires: true,
      dependencies
    })
  },
  npmToYarn (packageDir) {
    // TODO: error checking
    const packageLockFileString = fs.readFileSync(path.join(packageDir, 'package-lock.json'), 'utf-8')
    const packageLock = JSON.parse(packageLockFileString)
    const nodeModulesTree = nmTree(packageDir)
    const yarnTree = buildYarnTree(nodeModulesTree, packageLock)
    const formattedYarnObject = formatYarnTree(yarnTree)
    return lockfile.stringify(formattedYarnObject)
  }
}
