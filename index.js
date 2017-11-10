const fs = require('fs')
const path = require('path')
const lockfile = require('@yarnpkg/lockfile')
const crypto = require('crypto')

function getSemverString (packageDir, packageName) {
  // TODO: error checking
  const packageJson = require(`${packageDir}/package.json`)
  const { dependencies, devDependencies } = packageJson // TODO: optional deps? other deps?
  const allDeps = Object.assign({}, devDependencies, dependencies)
  // TODO: what do yarn/npm do when there are different versions in devDependencies and dependencies? is it possible?
  return allDeps[packageName]
}

function getSha1HexChecksum (base64String, packageDir, packageName) {
  if (/^sha1-/.test(base64String)) {
    return Buffer.from(base64String.replace(/^sha1-/, ''), 'base64').toString('hex')
  } else {
    // see caveats in README
    // TODO make generic
    return Buffer.from(base64String.replace(/^sha512-/, ''), 'base64').toString('hex')
  }
}

function buildYarnTree ({dependencies, packageDir, memo = {}}) {
  return Object.keys(dependencies).reduce((memo, packageName) => {
    const { version, resolved, integrity, requires } = dependencies[packageName]
    const deps = dependencies[packageName].dependencies
    if (deps) buildYarnTree({dependencies: deps, packageDir: path.join(packageDir, 'node_modules', packageName), memo})
    const semverString = getSemverString(packageDir, packageName)
    const hexChecksum = getSha1HexChecksum(integrity, packageDir, packageName)
    const yarnStyleResolved = `${resolved}#${hexChecksum}`
    const yarnStyleDeps = requires ? Object.keys(requires).reduce((depMemo, depPackageName) => {
      const version = requires[depPackageName]
      const semverStringDep = getSemverString(path.join(packageDir, 'node_modules', packageName), depPackageName)
      depMemo[depPackageName] = semverStringDep
      const existingEntryInMemo = memo[`${depPackageName}@${version}`]
      const existingSemverStringsInMemo = existingEntryInMemo && existingEntryInMemo.semverStrings ? existingEntryInMemo.semverStrings : []
      memo[`${depPackageName}@${version}`] = Object.assign({}, existingEntryInMemo || {}, {semverStrings: existingSemverStringsInMemo.concat(semverStringDep)})
      return depMemo
    }, {}) : undefined
    const existingEntryInMemo = memo[`${packageName}@${version}`]
    const existingSemverStringsInMemo = existingEntryInMemo && existingEntryInMemo.semverStrings ? existingEntryInMemo.semverStrings : []
    // this is not the yarn.lock semver format! this is just so the memo will be unique
    memo[`${packageName}@${version}`] = Object.assign({}, memo[`${packageName}@${version}`] || {}, {
      version,
      semverStrings: existingSemverStringsInMemo.concat(semverString || []),
      resolved: yarnStyleResolved,
      dependencies: yarnStyleDeps
    })
    return memo
  }, memo)
}

module.exports = {
  // yarnToNpm (yarnFileString, name, version) {
  yarnToNpm (packageDir) {
    // TODO: error checking
    const packageJson = fs.readFileSync(path.join(packageDir, 'package.json'))
    const { name, version } = JSON.parse(packageJson)
    const yarnLock = fs.readFileSync(path.join(packageDir, 'yarn.lock'), 'utf-8')
    const { object } = lockfile.parse(yarnLock)
    const semverDict = Object.keys(object).reduce((memo, packageNameAndVersion) => {
      const packageData = object[packageNameAndVersion]
      const resolvedWithChecksum = packageData.resolved
      const version = resolvedWithChecksum.replace(/^.*-(.+?)\.tgz#.*$/, '$1') // TODO: fix for more complex version strings that npm supports
      memo[packageNameAndVersion] = version
      return memo
    }, {})
    const { duplicates, deps } = Object.keys(object).reduce((memo, packageNameAndVersion) => {
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
        memo.deps[name] = {
          version,
          resolved,
          integrity: `sha1-${base64Checksum}`,
          requires
        }
      } else {
        memo.deps[name] = {
          version,
          resolved,
          integrity: `sha1-${base64Checksum}`,
          requires
        }
      }
      return memo
    }, {duplicates: {}, deps: {}})
    const dependencies = Object.keys(deps).reduce((memo, packageName) => {
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
    const packageLockFileString = fs.readFileSync(path.join(packageDir, 'package-lock.json'))
    const packageLock = JSON.parse(packageLockFileString)
    const { dependencies } = packageLock
    const objectWithSemver = buildYarnTree({dependencies, packageDir})
    const object = Object.keys(objectWithSemver).reduce((memo, packageNameWithVersion) => {
      const { semverStrings } = objectWithSemver[packageNameWithVersion]
      const packageName = packageNameWithVersion.replace(/@.+?$/, '') // TODO: handle scopes
      if (Array.isArray(semverStrings)) {
        semverStrings.forEach(s => {
          memo[`${packageName}@${s}`] = Object.assign(
            {},
            objectWithSemver[packageNameWithVersion],
            { semverStrings: undefined }
          )
        })
      } else { // TODO: this should be eliminated
        memo[`${packageName}@${undefined}`] = Object.assign(
          {},
          objectWithSemver[packageNameWithVersion],
          { semverStrings: undefined }
        )
      }
      return memo
    }, {})
    return lockfile.stringify(object)
  }
}
