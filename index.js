'use strict'

const fs = require('fs')
const path = require('path')
const { convertYarnToNpm, convertNpmToYarn } = require('./lib')

module.exports = {
  yarnToNpm (packageDir) {
    const yarnLock = fs.readFileSync(
      path.join(packageDir, 'yarn.lock'),
      'utf-8'
    )
    const packageJson = fs.readFileSync(path.join(packageDir, 'package.json'))
    const { name, version } = JSON.parse(packageJson)
    return convertYarnToNpm(yarnLock, name, version, packageDir)
  },
  npmToYarn (packageDir) {
    const packageLockFileString = fs.readFileSync(
      path.join(packageDir, 'package-lock.json'),
      'utf-8'
    )
    return convertNpmToYarn(packageLockFileString, packageDir)
  }
}
