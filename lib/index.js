'use strict'

const { join } = require('path')
const { readJson } = require('../util/read')
const { convertYarnToNpmV1, convertNpmV1ToYarn } = require('./lockfileV1')
const { convertYarnToNpmV2, convertNpmV2ToYarn } = require('./lockfileV2')

module.exports = {
  convertYarnToNpm (yarnLock, name, version, packageDir) {
    const packageJson = readJson(join(packageDir, 'package.json'))

    // NOTE workspaces require lockfile v2
    return packageJson.workspaces
      ? convertYarnToNpmV2(yarnLock, name, version, packageDir, packageJson)
      : convertYarnToNpmV1(yarnLock, name, version, packageDir, packageJson)
  },
  convertNpmToYarn (packageLockFileString, packageDir) {
    const packageLock = JSON.parse(packageLockFileString)
    const { lockfileVersion } = packageLock

    return lockfileVersion === 2
      ? convertNpmV2ToYarn(packageLockFileString, packageDir)
      : convertNpmV1ToYarn(packageLockFileString, packageDir)
  }
}
