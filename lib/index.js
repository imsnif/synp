'use strict'

const { join } = require('path')
const { read } = require('../util/read')
const { convertYarnToNpmV1, convertNpmV1ToYarn } = require('./lockfileV1')
const { convertYarnToNpmV2, convertNpmV2ToYarn } = require('./lockfileV2')

const checkWorkspace = (requiresWorkspace, withWorkspace) => {
  if (requiresWorkspace && !withWorkspace) {
    console.warn('Workspace (npm lockfile v2) support is experimental. Pass `--with-workspace` flag to enable and cross your fingers. Good luck!')

    return false
  }

  return requiresWorkspace
}

module.exports = {
  convertYarnToNpm (yarnLock, name, version, packageDir, withWorkspace) {
    const packageJson = read(join(packageDir, 'package.json'))
    const requiresWorkspace = !!packageJson.workspaces

    return checkWorkspace(requiresWorkspace, withWorkspace)
      ? convertYarnToNpmV2(yarnLock, name, version, packageDir, packageJson)
      : convertYarnToNpmV1(yarnLock, name, version, packageDir, packageJson)
  },
  convertNpmToYarn (packageLockFileString, packageDir, withWorkspace) {
    const packageLock = JSON.parse(packageLockFileString)
    const { lockfileVersion } = packageLock
    const requiresWorkspace = lockfileVersion === 2

    return checkWorkspace(requiresWorkspace, withWorkspace)
      ? convertNpmV2ToYarn(packageLockFileString, packageDir)
      : convertNpmV1ToYarn(packageLockFileString, packageDir)
  }
}
