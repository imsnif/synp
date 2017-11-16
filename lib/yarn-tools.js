'use strict'

const path = require('path')

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

function findEntryInPackageLock (entry, flattenedPackageLock) {
  const { name, version, _resolved } = entry
  return flattenedPackageLock[`${name}@${version}`] ||
    flattenedPackageLock[`${name}@${_resolved}`]
}

function placeEntryInTree (entry, allDeps, flattenedPackageLock, tree) {
  const { name, version } = entry
  const {
    resolved,
    integrity
  } = findEntryInPackageLock(entry, flattenedPackageLock)
  const { dependencies, optionalDependencies } = allDeps
  const yarnStyleResolved = npmToYarnResolved(resolved || version, integrity)
  const existingPackage = tree[name] || {}
  const existingPackageVersion = tree[name] && tree[name][version]
    ? tree[name][version]
    : {}
  const hasDeps = dependencies && Object.keys(dependencies).length > 0
  const hasOptionalDeps = optionalDependencies &&
    Object.keys(optionalDependencies).length > 0
  tree[name] = Object.assign({}, existingPackage, {
    [version]: Object.assign({}, existingPackageVersion, {
      resolved: yarnStyleResolved
    },
      hasDeps ? {dependencies} : {},
      hasOptionalDeps ? {optionalDependencies} : {}
    )
  })
}

function placeDepsInTree (deps, path, nodeModulesTree, tree) {
  Object.keys(deps).forEach(dep => {
    const depSemver = deps[dep]
    try {
      const depVersion = findDepVersion(dep, nodeModulesTree, path)
      const existingPackage = tree[dep] || {}
      const existingPackageVersion = tree[dep] && tree[dep][depVersion]
        ? tree[dep][depVersion]
        : {}
      const existingSemvers = tree[dep] &&
        tree[dep][depVersion] &&
        tree[dep][depVersion].semvers
      tree[dep] = Object.assign({}, existingPackage, {
        [depVersion]: Object.assign({},
          existingPackageVersion,
          {
            semvers: existingSemvers
              ? existingSemvers.add(depSemver)
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

function formatDependencies (packageEntry, packageLock) {
  const { name, dependencies, devDependencies, optionalDependencies } = packageEntry
  const depsWithoutOptional = optionalDependencies
    ? Object.keys(dependencies).reduce((deps, depName) => {
      if (optionalDependencies[depName]) return deps
      const entry = dependencies[depName]
      deps[depName] = entry
      return deps
    }, {})
    : dependencies
  const devDeps = name === packageLock.name ? devDependencies : {}
  return { dependencies: depsWithoutOptional, optionalDependencies, devDependencies: devDeps }
}

function extractVersion (url, packageName) {
  // TODO: error checking
  const re = new RegExp(`${packageName}/-/${packageName}-(.+?).tgz$`)
  const matches = url.match(re)
  if (matches && matches[1]) return matches[1]
  return url
}

module.exports = {
  buildYarnTree (nodeModulesTree, packageLock) {
    const flattenedPackageLock = flattenPackageLock(packageLock.dependencies)
    return Object.keys(nodeModulesTree).reduce((tree, path) => {
      const { name } = nodeModulesTree[path]
      const nmEntry = nodeModulesTree[path]
      const allDeps = formatDependencies(nmEntry, packageLock)
      if (name !== packageLock.name) {
        placeEntryInTree(nmEntry, allDeps, flattenedPackageLock, tree)
      }
      const deps = Object.assign({},
        allDeps.dependencies,
        allDeps.optionalDependencies,
        allDeps.devDependencies
      )
      placeDepsInTree(deps, path, nodeModulesTree, tree)
      return tree
    }, {})
  },
  formatYarnTree (yarnTree) {
    return Object.keys(yarnTree).reduce((formatted, packageName) => {
      const entry = yarnTree[packageName]
      Object.keys(entry).forEach(version => {
        const { semvers } = entry[version]
        const nonUrlVersion = extractVersion(version, packageName)
        semvers.forEach(sver => {
          formatted[`${packageName}@${sver}`] = Object.assign({}, entry[version], {
            semvers: undefined,
            version: nonUrlVersion,
            resolved: entry[version].resolved || version
          })
        })
      })
      return formatted
    }, {})
  },
  findPackageInYarnLock (name, version, yarnObject) {
    const packageKey = Object.keys(yarnObject).find(yPackage => {
      const yPackageName = yPackage.replace(/^(.+?)@.+?$/, '$1')
      return yPackageName === name && yarnObject[yPackage].version === version
    })
    return yarnObject[packageKey]
  }
}
