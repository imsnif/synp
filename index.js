'use strict'

const fs = require('fs')
const path = require('path')
const lockfile = require('@yarnpkg/lockfile')
const eol = require('eol')
const nmtree = require('nmtree')
const { buildYarnTree, buildNpmTree } = require('./lib/tree')

module.exports = {
  yarnToNpm (packageDir) {
    const yarnLock = fs.readFileSync(
      path.join(packageDir, 'yarn.lock'),
      'utf-8'
    )
    const yarnLockNormalized = eol.lf(yarnLock)
    const yarnObject = lockfile.parse(yarnLockNormalized).object
    const nodeModulesTree = nmtree(packageDir)
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
    const packageLockFileString = fs.readFileSync(
      path.join(packageDir, 'package-lock.json'),
      'utf-8'
    )
    const packageLock = JSON.parse(packageLockFileString)
    const nodeModulesTree = nmtree(packageDir)
    const yarnTree = buildYarnTree(nodeModulesTree, packageLock)
    return lockfile.stringify(yarnTree)
  }
}
