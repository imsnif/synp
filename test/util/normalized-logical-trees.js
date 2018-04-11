'use strict'

const npmLogicalTree = require('npm-logical-tree')
const yarnLogicalTree = require('yarn-logical-tree')

module.exports = {
  createYarnLogicalTree (yarnLockObject, packageJson) {
    const tree = yarnLogicalTree(packageJson, yarnLockObject)
    let flattened = {}
    tree.forEach((node, cb) => {
      const version = /^git+/.test(node.resolved) ? node.resolved : node.version // account for differences in how npm/yarn store github deps
      flattened[`${node.name}@${version}`] = {
        name: node.name,
        version,
        dependencies: Array.from(node.dependencies.entries()).reduce((dependencies, [name, value]) => {
          const version = /^git+/.test(value.resolved) ? value.resolved : value.version
          dependencies[name] = version
          return dependencies
        }, {})
      }
      cb()
    })
    return flattened
  },
  createNpmLogicalTree (packageLock, packageJson) {
    const tree = npmLogicalTree(packageJson, packageLock)
    let flattened = {}
    tree.forEach((node, cb) => {
      flattened[`${node.name}@${node.version}`] = {
        name: node.name,
        version: node.version,
        dependencies: Array.from(node.dependencies.entries()).reduce((dependencies, [name, value]) => {
          dependencies[name] = value.version
          return dependencies
        }, {})
      }
      cb()
    })
    return flattened
  }
}
