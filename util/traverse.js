'use strict'

const { join, sep } = require('path')

function parentPackagePath (parentPath) {
  const nmPos = (sep + parentPath).lastIndexOf(`${sep}node_modules${sep}`)

  if (nmPos === -1) {
    throw new Error('Could not find parent dir!')
  }

  return parentPath.slice(0, nmPos && nmPos - sep.length)
}

function findDepVersion (dep, nodeModulesTree, parentPath) {
  const depPath = join(parentPath, 'node_modules', dep)
  if (nodeModulesTree[depPath]) {
    const { version } = nodeModulesTree[depPath]
    return version
  } else {
    const oneLevelDown = parentPackagePath(parentPath)
    return findDepVersion(dep, nodeModulesTree, oneLevelDown)
  }
}

function findFileEntryInPackageLock (name, flattenedPackageLock) {
  const packageKey = Object.keys(flattenedPackageLock).find(key => {
    return key.startsWith(`${name}@file:`)
  })
  return flattenedPackageLock[packageKey]
}

module.exports = {
  findDepVersion,
  findEntryInPackageLock (entry, flattenedPackageLock) {
    const { name, version, _resolved } = entry
    return flattenedPackageLock[`${name}@${version}`] ||
      flattenedPackageLock[`${name}@${_resolved}`] ||
      findFileEntryInPackageLock(name, flattenedPackageLock)
  },
  findPackageInYarnLock (name, version, yarnObject) {
    const packageKey = Object.keys(yarnObject).find(yPackage => {
      const yPackageName = yPackage.replace(/^(.+?)@.+?$/, '$1')
      return yPackageName === name && yarnObject[yPackage].version === version
    })

    const entry = yarnObject[packageKey]
    const request = entry ? packageKey.match(/^.+?@(.+?)$/)[1] : undefined

    return {
      entry,
      request
    }
  },
  getParentPackageInYarnTree (modulesInPath, tree) {
    return modulesInPath.slice(0, -1).reduce((prev, next) => {
      if (prev && (prev[next] || (prev.dependencies && prev.dependencies[next]))) {
        return prev[next] || prev.dependencies[next]
      } else {
        return { dependencies: tree }
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
  },
  parentPackagePath
}
