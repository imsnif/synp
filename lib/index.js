'use strict'

const {convertYarnToNpmV1, convertNpmV1ToYarn} = require('./lockfileV1')
const {convertYarnToNpmV2, convertNpmV2ToYarn} = require('./lockfileV2')

module.exports = {
  convertYarnToNpm (yarnLock, name, version, packageDir) {
    const lockfileVersion = JSON.parse(readFileSync(join(packageDir, 'package.json')).toString('utf-8').trim()).workspaces
      ? 2
      : 1

    return lockfileVersion === 2
      ? convertYarnToNpmV2(yarnLock, name, version, packageDir)
      : convertYarnToNpmV1(yarnLock, name, version, packageDir)
  },
  convertNpmToYarn (packageLockFileString, packageDir) {
    const packageLock = JSON.parse(packageLockFileString)
    const {lockfileVersion} = packageLock

    return lockfileVersion === 2
      ? convertNpmV2ToYarn(packageLockFileString, packageDir)
      : convertNpmV1ToYarn(packageLockFileString, packageDir)
  }
}
