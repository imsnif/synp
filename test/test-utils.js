'use strict'

function findNonSha1Hashes ({ dependencies, memo = [] }) {
  return Object.keys(dependencies).reduce((memo, packageName) => {
    if (!/^sha1-/.test(dependencies[packageName].integrity)) {
      memo.push(dependencies[packageName].resolved)
    }
    if (dependencies[packageName].dependencies) {
      findNonSha1Hashes({ dependencies: dependencies[packageName].dependencies, memo })
    }
    return memo
  }, memo)
}

function replaceNonSha1 (yarnObj, resolvedWithNonSha1Hashes) {
  return Object.assign({}, yarnObj, {
    object:
    Object.keys(yarnObj.object).reduce((memo, packageName) => {
      const entry = yarnObj.object[packageName]
      const strippedResolved = entry.resolved.replace(/#.+?$/, '')
      if (resolvedWithNonSha1Hashes.indexOf(strippedResolved) !== -1) {
        memo[packageName] = Object.assign({}, entry, { resolved: `${strippedResolved}#N/A` })
      } else {
        memo[packageName] = entry
      }
      return memo
    }, {})
  })
}

function normalizePackageLock (npmObj, resolvedWithNonSha1Hashes) {
  return Object.assign({}, npmObj, {
    dependencies:
    Object.keys(npmObj.dependencies).reduce((memo, packageName) => {
      const entry = npmObj.dependencies[packageName]
      if (resolvedWithNonSha1Hashes.indexOf(entry.resolved) !== -1) {
        memo[packageName] = Object.assign({}, entry, { integrity: 'N/A' })
      } else {
        memo[packageName] = entry
      }
      if (entry.dependencies && Object.keys(entry.dependencies).length > 0) {
        const { dependencies } = normalizePackageLock(entry, resolvedWithNonSha1Hashes)
        memo[packageName] = Object.assign({}, memo[packageName], { dependencies })
      }
      delete memo[packageName].optional // see caveats in README
      return memo
    }, {})
  })
}

module.exports = {
  normalizePackageLock, findNonSha1Hashes, replaceNonSha1
}
