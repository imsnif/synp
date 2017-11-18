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
    return findDepVersion(dep, nodeModulesTree, oneLevelDown)
  }
}

module.exports = {
  findDepVersion,
  findEntryInPackageLock (entry, flattenedPackageLock) {
    const { name, version, _resolved } = entry
    return flattenedPackageLock[`${name}@${version}`] ||
      flattenedPackageLock[`${name}@${_resolved}`]
  },
  findPackageInYarnLock (name, version, yarnObject) {
    const packageKey = Object.keys(yarnObject).find(yPackage => {
      const yPackageName = yPackage.replace(/^(.+?)@.+?$/, '$1')
      return yPackageName === name && yarnObject[yPackage].version === version
    })
    return yarnObject[packageKey]
  },
  getParentPackageInYarnTree (modulesInPath, tree) {
    return modulesInPath.slice(0, -1).reduce((prev, next) => {
      if (prev && (prev[next] || (prev.dependencies && prev.dependencies[next]))) {
        return prev[next] || prev.dependencies[next]
      } else {
        return tree
      }
    }, tree)
  },
  splitPathToModules (relativePath) {
    return relativePath
    .filter(p => p !== 'node_modules')
    .reduce((packages, dirName, index, rPath) => {
      if (/^@/.test(dirName)) {
        packages.push(`${dirName}/${rPath[index + 1]}`)
      } else if (!(rPath[index - 1] && /^@/.test(rPath[index - 1]))) {
        packages.push(dirName)
      }
      return packages
    }, [])
  }
}
