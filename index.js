'use strict'

const fs = require('fs')
const path = require('path')
const lockfile = require('@yarnpkg/lockfile')
const nmTree = require('./lib/nmtree')
const { buildYarnTree, formatYarnTree } = require('./lib/yarn-tools')

function buildSemverDict (object) {
  return Object.keys(object).reduce((memo, packageNameAndVersion) => {
    const packageData = object[packageNameAndVersion]
    const resolvedWithChecksum = packageData.resolved
    const version = resolvedWithChecksum.replace(/^.*-(.+?)\.tgz#.*$/, '$1') // TODO: fix for more complex version strings that npm supports
    memo[packageNameAndVersion] = version
    return memo
  }, {})
}

function buildNpmTree (object, semverDict) {
  return Object.keys(object).reduce((memo, packageNameAndVersion) => {
    const packageData = object[packageNameAndVersion]
    const name = packageNameAndVersion.replace(/@.+?$/, '') // TODO: handle scopes
    const resolvedWithChecksum = packageData.resolved
    const version = resolvedWithChecksum.replace(/^.*-(.+?)\.tgz#.*$/, '$1') // TODO: fix for more complex version strings that npm supports
    const resolved = resolvedWithChecksum.replace(/#.+?$/, '')
    const hexChecksum = resolvedWithChecksum.replace(/^.+?#/, '')
    const base64Checksum = Buffer.from(hexChecksum, 'hex').toString('base64')
    const packageDeps = packageData.dependencies
    const requires = packageDeps ? Object.keys(packageDeps).reduce((reqMemo, packageName) => {
      const packageNameAndVersion = `${packageName}@${packageDeps[packageName]}`
      const version = semverDict[packageNameAndVersion]
      reqMemo[packageName] = version
      return reqMemo
    }, {}) : undefined
    if (memo.deps[name] && memo.deps[name].version !== version) {
      const packageInMemo = Object.assign({}, memo.deps[name])
      memo.duplicates = memo.duplicates || {}
      memo.duplicates[name] = packageInMemo // TODO: find package-lock.json logic for this
    }
    memo.deps[name] = {
      version,
      resolved,
      integrity: `sha1-${base64Checksum}`,
      requires
    }
    return memo
  }, {duplicates: {}, deps: {}})
}

function buildNpmDependencies (deps, duplicates) {
  return Object.keys(deps).reduce((memo, packageName) => {
    const entry = deps[packageName]
    const entryDependencies = entry.requires ? Object.keys(entry.requires).reduce((eMemo, reqPackageName) => {
      if (duplicates[reqPackageName] && duplicates[reqPackageName].version === entry.requires[reqPackageName]) {
        eMemo[reqPackageName] = duplicates[reqPackageName]
      }
      return eMemo
    }, {}) : null
    memo[packageName] = Object.assign(
      {},
      entry,
      entryDependencies && Object.keys(entryDependencies).length > 0 ? {dependencies: entryDependencies} : {}
    )
    return memo
  }, {})
}

module.exports = {
  yarnToNpm (packageDir) {
    // TODO: error checking
    const packageJson = fs.readFileSync(path.join(packageDir, 'package.json'))
    const { name, version } = JSON.parse(packageJson)
    const yarnLock = fs.readFileSync(path.join(packageDir, 'yarn.lock'), 'utf-8')
    const { object } = lockfile.parse(yarnLock)
    const semverDict = buildSemverDict(object)
    const { duplicates, deps } = buildNpmTree(object, semverDict)
    const dependencies = buildNpmDependencies(deps, duplicates)
    return JSON.stringify({
      name,
      version,
      lockfileVersion: 1,
      requires: true,
      dependencies
    })
  },
  npmToYarn (packageDir) {
    // TODO: error checking
    const packageLockFileString = fs.readFileSync(path.join(packageDir, 'package-lock.json'), 'utf-8')
    const packageLock = JSON.parse(packageLockFileString)
    const nodeModulesTree = nmTree(packageDir)
    const yarnTree = buildYarnTree(nodeModulesTree, packageLock)
    const formattedYarnObject = formatYarnTree(yarnTree)
    return lockfile.stringify(formattedYarnObject)
  }
}
