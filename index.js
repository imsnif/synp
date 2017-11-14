const fs = require('fs')
const path = require('path')
const lockfile = require('@yarnpkg/lockfile')
const crypto = require('crypto')
const nmTree = require('./lib/nmtree')

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

function parentPackagePath (parentPath) {
  const dirs = parentPath.split(path.sep)
  const pathDirs = dirs.slice(0, dirs.length - 1)
  if (pathDirs[pathDirs.length - 1] === 'node_modules') {
    return parentPackagePath(pathDirs.join(path.sep))
  } else if (pathDirs.join(path.sep) === '/' || pathDirs.join(path.sep) === '') {
    throw new Error('Could not find parent dir!')
  } else {
    return pathDirs.join(path.sep)
  }
}

function findDepVersion (dep, nodeModulesTree, parentPath) {
  const depPath = path.join(parentPath, 'node_modules', dep)
  if (nodeModulesTree[depPath]) {
    const { version } = nodeModulesTree[depPath]
    return version
  } else {
    const oneLevelDown = parentPackagePath(parentPath)
    if (oneLevelDown === '/') {
      throw new Error(`Could not find package ${dep}`)
    }
    return findDepVersion(dep, nodeModulesTree, oneLevelDown)
  }
}

function npmToYarnResolved (resolved, integrity) {
  const hexChecksum = /^sha1-/.test(integrity)
    ? Buffer.from(integrity.replace(/^sha1-/, ''), 'base64').toString('hex')
    : Buffer.from(integrity.replace(/^sha512-/, ''), 'base64').toString('hex')
    // see caveats in README
  return `${resolved}#${hexChecksum}`
}

function flattenPackageLock (deps, flattenedTree) {
  flattenedTree = flattenedTree || {}
  return Object.keys(deps).reduce((flattenedTree, depName) => {
    const { version, dependencies } = deps[depName]
    if (!deps[depName].bundled) {
      const resolved = deps[depName].resolved || version
      // https://docs.npmjs.com/files/package-lock.json#version-1
      flattenedTree[`${depName}@${version}`] = Object.assign({}, deps[depName], {resolved})
    }
    if (dependencies) flattenPackageLock(dependencies, flattenedTree)
    return flattenedTree
  }, flattenedTree)
}

function buildYarnTree (nodeModulesTree, packageLock) {
  const flattenedPackageLock = flattenPackageLock(packageLock.dependencies)
  return Object.keys(nodeModulesTree).reduce((tree, path) => {
    const { name, version, dependencies, optionalDependencies, devDependencies, _resolved } = nodeModulesTree[path]
    if (name !== packageLock.name) {
      if (!flattenedPackageLock[`${name}@${version}`]) {
        return tree // TODO: fix this, this mostly has to do with bundled dependencies
      }
      const { resolved, integrity } = flattenedPackageLock[`${name}@${version}`] || flattenedPackageLock[`${name}@${_resolved}`]
      const yarnStyleResolved = npmToYarnResolved(resolved || version, integrity)
      if (optionalDependencies) {
        Object.keys(optionalDependencies).forEach(optDepName => {
          delete dependencies[optDepName]
        })
      }
      tree[name] = Object.assign({}, tree[name] || {}, {
        [version]: Object.assign({},
          tree[name] && tree[name][version]
            ? tree[name][version]
            : {},
          { resolved: yarnStyleResolved },
          dependencies && Object.keys(dependencies).length > 0 ? {dependencies} : {},
          optionalDependencies && Object.keys(optionalDependencies).length > 0 ? {optionalDependencies} : {}
        )
      })
    }
    if (dependencies || optionalDependencies) {
      const combinedDeps = Object.assign({}, dependencies, optionalDependencies, name === packageLock.name ? devDependencies : {})
      Object.keys(combinedDeps).forEach(dep => {
        const depSemver = combinedDeps[dep]
        try {
          const depVersion = findDepVersion(dep, nodeModulesTree, path)
          tree[dep] = Object.assign({}, tree[dep] || {}, {
            [depVersion]: Object.assign({},
              tree[dep] && tree[dep][depVersion] ? tree[dep][depVersion] : {},
              {
                semvers: tree[dep] && tree[dep][depVersion] && tree[dep][depVersion].semvers
                  ? tree[dep][depVersion].semvers.add(depSemver)
                  : new Set([depSemver])
              }
            )
          })
        } catch (e) {
          // non-existent package, likely due to platform mismatch (eg. fsevents)
          // TODO: fix this!
          return tree
        }
      })
    }
    return tree
  }, {})
}

function extractVersion (url, packageName) {
  // TODO: error checking
  const re = new RegExp(`${packageName}\/-\/${packageName}-(.+?)\.tgz$`)
  const matches = url.match(re)
  if (matches && matches[1]) return matches[1]
  return url
}

function formatYarnTree (yarnTree) {
  return Object.keys(yarnTree).reduce((formatted, packageName) => {
    const entry = yarnTree[packageName]
    Object.keys(entry).forEach(version => {
      const { semvers } = entry[version]
      if (semvers) { // TODO: fix this (likely due to bundled issue)
        const nonUrlVersion = extractVersion(version, packageName)
        if (entry[version].resolved) {
          semvers.forEach(sver => {
            formatted[`${packageName}@${sver}`] = Object.assign({}, entry[version], {
              semvers: undefined,
              version: nonUrlVersion,
              resolved: entry[version].resolved || version
            })
          })
        }
      }
    })
    return formatted
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
    const { dependencies } = packageLock
    const nodeModulesTree = nmTree(packageDir)
    const yarnTree = buildYarnTree(nodeModulesTree, packageLock)
    const formattedYarnObject = formatYarnTree(yarnTree)
    return lockfile.stringify(formattedYarnObject)
  }
}
