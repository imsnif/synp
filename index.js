'use strict'

const fs = require('fs')
const path = require('path')
const lockfile = require('@yarnpkg/lockfile')
const eol = require('eol')

const { createYarnTree } = require('./lib/yarn-tree')
const { createLogicalTreeNpm, createLogicalTreeYarn } = require('./lib/logical-tree')
const { createPhysicalTree } = require('./lib/physical-tree')
const { createPackageLockTree } = require('./lib/package-lock-tree')
const { stringifyPackageLock } = require('./util/format')

module.exports = {
  async yarnToNpm (packageDir) {
    const yarnLock = fs.readFileSync(
      path.join(packageDir, 'yarn.lock'),
      'utf-8'
    )
    const yarnLockNormalized = eol.lf(yarnLock)
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8')
    )
    const yarnObject = lockfile.parse(yarnLockNormalized).object
    try {
      const logicalTree = await createLogicalTreeYarn({packageJson, yarnLock: yarnObject})
      const physicalTree = createPhysicalTree({logicalTree})
      const packageLock = createPackageLockTree({physicalTree})
      return stringifyPackageLock({packageLock, packageJson})
    } catch (e) {
      throw e
    }
  },
  async npmToYarn (packageDir) {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8')
    )
    const packageLock = JSON.parse(
      fs.readFileSync(
        path.join(packageDir, 'package-lock.json'),
        'utf-8'
      )
    )
    try {
      const logicalTree = await createLogicalTreeNpm({packageJson, packageLock})
      const yarnLock = createYarnTree({logicalTree})
      return lockfile.stringify(yarnLock)
    } catch (e) {
      throw e
    }
  }
}
