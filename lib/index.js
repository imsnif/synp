'use strict'

const lockfile = require('@yarnpkg/lockfile')
const eol = require('eol')
const nmtree = require('nmtree')
const { buildYarnTree, buildNpmTree } = require('./tree')

module.exports = {
  convertYarnToNpm (yarnLock, name, version, packageDir) {
    const yarnLockNormalized = eol.lf(yarnLock)
    const yarnObject = lockfile.parse(yarnLockNormalized).object
    const nodeModulesTree = nmtree(packageDir)
    const dependencies = buildNpmTree(nodeModulesTree, yarnObject)
    return JSON.stringify({
      name,
      version,
      lockfileVersion: 1,
      requires: true,
      dependencies
    })
  },
  convertNpmToYarn (packageLockFileString, packageDir) {
    const packageLock = JSON.parse(packageLockFileString)
    const nodeModulesTree = nmtree(packageDir)
    const yarnTree = buildYarnTree(nodeModulesTree, packageLock)
    return lockfile.stringify(yarnTree)
  }
}
