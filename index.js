'use strict'

const fs = require('fs')
const path = require('path')
const lockfile = require('@yarnpkg/lockfile')
const nmTree = require('./lib/nmtree')
const { buildYarnTree, formatYarnTree } = require('./lib/yarn-tools')
const { buildNpmTree } = require('./lib/package-lock-tools')

module.exports = {
  yarnToNpm (packageDir) {
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
    const packageLockFileString = fs.readFileSync(path.join(packageDir, 'package-lock.json'), 'utf-8')
    const packageLock = JSON.parse(packageLockFileString)
    const nodeModulesTree = nmTree(packageDir)
    const yarnTree = buildYarnTree(nodeModulesTree, packageLock)
    const formattedYarnObject = formatYarnTree(yarnTree)
    return lockfile.stringify(formattedYarnObject)
  }
}
