'use strict'

const path = require('path')
const { convertYarnToNpm, convertNpmToYarn } = require('./lib')
const { read } = require('./util/read')

module.exports = {
  yarnToNpm (packageDir, withWorkspace) {
    const yarnLock = read(path.join(packageDir, 'yarn.lock'), true)
    const { name, version } = read(path.join(packageDir, 'package.json'))

    return convertYarnToNpm(yarnLock, name, version, packageDir, withWorkspace)
  },
  npmToYarn (packageDir, withWorkspace) {
    const packageLockFileString = read(path.join(packageDir, 'package-lock.json'), true)

    return convertNpmToYarn(packageLockFileString, packageDir, withWorkspace)
  }
}
