'use strict'

module.exports = {
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
