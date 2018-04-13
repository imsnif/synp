'use strict'

const fs = require('fs')
const path = require('path')
const lockfile = require('@yarnpkg/lockfile')
const eol = require('eol')

const { manifestFetcher } = require('./lib/manifest-fetcher')
const { createYarnTree } = require('./lib/yarn-tree')
const { createLogicalTree } = require('./lib/logical-tree')
const { createPhysicalTree } = require('./lib/physical-tree')
const { createPackageLockTree } = require('./lib/package-lock-tree')
const { stringifyPackageLock } = require('./util/format')

module.exports = {
  async yarnToNpm (packageDir, logProgress) {
    const log = logProgress || function () {}
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
      const getManifest = manifestFetcher(packageDir, log)
      log('Creating logical tree...')
      const logicalTree = await createLogicalTree({packageJson, yarnLock: yarnObject, getManifest})
      log('Creating physical tree...')
      const physicalTree = createPhysicalTree({logicalTree})
      log('Formatting package-lock.json...')
      const packageLock = createPackageLockTree({physicalTree})
      return stringifyPackageLock({packageLock, packageJson})
    } catch (e) {
      throw e
    }
  },
  async npmToYarn (packageDir, logProgress) {
    const log = logProgress || function () {}
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
      const getManifest = manifestFetcher(packageDir, log)
      log('Creating logical tree...')
      const logicalTree = await createLogicalTree({packageJson, packageLock, getManifest})
      log('Formatting yarn.lock...')
      const yarnLock = createYarnTree({logicalTree})
      return lockfile.stringify(yarnLock)
    } catch (e) {
      throw e
    }
  }
}
