const fs = require('fs')
const path = require('path')
const lockfile = require('@yarnpkg/lockfile')
const crypto = require('crypto')

function getSemverString (packageDir, packageName) {
  // TODO: error checking
  const packageJson = require(`${packageDir}/package.json`)
  const { dependencies, devDependencies, optionalDependencies } = packageJson
  const allDeps = Object.assign({}, devDependencies, dependencies, optionalDependencies)
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

function buildYarnDependencies (requires, packageDir, packageName, tree) {
  if (!requires) return undefined
  return Object.keys(requires).reduce((depMemo, depPackageName) => {
    const version = requires[depPackageName]
    const semverStringDep = getSemverString(path.join(packageDir, 'node_modules', packageName), depPackageName)
    depMemo[depPackageName] = semverStringDep
    const existingEntryInMemo = tree[`${depPackageName}@${version}`]
    const existingSemverStringsInMemo = existingEntryInMemo && existingEntryInMemo.semverStrings ? existingEntryInMemo.semverStrings : []
    tree[`${depPackageName}@${version}`] = Object.assign({}, existingEntryInMemo || {}, {semverStrings: existingSemverStringsInMemo.concat(semverStringDep)})
    return depMemo
  }, {})
}

function buildYarnTree ({dependencies, packageDir, tree = {}}) {
  return Object.keys(dependencies).reduce((tree, packageName) => {
    const { version, resolved, integrity, requires } = dependencies[packageName]
    const deps = dependencies[packageName].dependencies
    if (deps) buildYarnTree({dependencies: deps, packageDir: path.join(packageDir, 'node_modules', packageName), tree})
    const semverString = getSemverString(packageDir, packageName)
    const hexChecksum = getSha1HexChecksum(integrity, packageDir, packageName)
    const yarnStyleResolved = `${resolved}#${hexChecksum}`
    const yarnStyleDeps = buildYarnDependencies(requires, packageDir, packageName, tree)
    const existingEntryInTree = tree[`${packageName}@${version}`]
    const existingSemverStringsInTree = existingEntryInTree && existingEntryInTree.semverStrings ? existingEntryInTree.semverStrings : []
    tree[`${packageName}@${version}`] = Object.assign({}, tree[`${packageName}@${version}`] || {}, {
      version,
      semverStrings: existingSemverStringsInTree.concat(semverString || []),
      resolved: yarnStyleResolved,
      dependencies: yarnStyleDeps
    })
    return tree
  }, tree)
}

function formatSemverStrings (objectWithSemver) {
  return Object.keys(objectWithSemver).reduce((memo, packageNameWithVersion) => {
    const { semverStrings } = objectWithSemver[packageNameWithVersion]
    const packageName = packageNameWithVersion.replace(/@.+?$/, '') // TODO: handle scopes
    semverStrings.reduce((memo, semverString) => {
      memo[`${packageName}@${semverString}`] = Object.assign(
        {},
        objectWithSemver[packageNameWithVersion],
        { semverStrings: undefined }
      )
      return memo
    }, memo)
    return memo
  }, {})
}

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
    const packageLockFileString = fs.readFileSync(path.join(packageDir, 'package-lock.json'))
    const packageLock = JSON.parse(packageLockFileString)
    const { dependencies } = packageLock
    const objectWithSemver = buildYarnTree({dependencies, packageDir})
    const object = formatSemverStrings(objectWithSemver)
    return lockfile.stringify(object)
  }
}
