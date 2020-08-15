'use strict'

const lockfile = require('@yarnpkg/lockfile')
const eol = require('eol')
const nmtree = require('nmtree')
const { buildYarnTree, buildNpmTree } = require('./tree')
const {readFileSync} = require('fs')
const {join} = require('path')

module.exports = {
  convertYarnToNpmV1 (yarnLock, name, version, packageDir) {
    const yarnLockNormalized = eol.lf(yarnLock)
    const yarnObject = lockfile.parse(yarnLockNormalized).object
    const nodeModulesTree = nmtree(packageDir)
    const dependencies = buildNpmTree(nodeModulesTree, yarnObject)

    return JSON.stringify({
      name,
      version,
      lockfileVersion,
      requires: true,
      dependencies
    })
  },
  convertNpmV1ToYarn (packageLockFileString, packageDir) {
    const packageLock = JSON.parse(packageLockFileString)
    const nodeModulesTree = nmtree(packageDir)
    const yarnTree = buildYarnTree(nodeModulesTree, packageLock)
    return lockfile.stringify(yarnTree)
  }
}
