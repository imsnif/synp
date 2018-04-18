'use strict'

const npmLogicalTree = require('npm-logical-tree')
const yarnLogicalTree = require('yarn-logical-tree')

const semver = require('semver')

// TODO: better job merging these two functions

module.exports = {
  createYarnLogicalTree (yarnLockObject, packageJson) {
    const tree = yarnLogicalTree(packageJson, yarnLockObject)
    let flattened = {}
    tree.forEach((node, cb) => {
      const version = /^git+/.test(node.resolved)
        ? node.resolved
        : node.version && semver.coerce(node.version)
        ? semver.coerce(node.version).version
        : undefined
      flattened[`${node.name}@${version}`] = {
        name: node.name,
        version,
        dependencies: Array.from(node.dependencies.entries()).reduce((dependencies, [name, value]) => {
          const version = /^git+/.test(value.resolved)
            ? value.resolved
            : value.version && semver.coerce(value.version)
            ? semver.coerce(value.version).version
            : undefined
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
      const version = /^git+/.test(node.version)
        ? node.version
        : node.version && semver.coerce(node.version)
        ? semver.coerce(node.version).version
        : undefined
      flattened[`${node.name}@${version}`] = {
        name: node.name,
        version,
        dependencies: Array.from(node.dependencies.entries()).reduce((dependencies, [name, value]) => {
          const version = /^git+/.test(value.version)
            ? value.version
            : value.version && semver.coerce(value.version)
            ? semver.coerce(value.version).version
            : undefined
          dependencies[name] = version
          return dependencies
        }, {})
      }
      cb()
    })
    return flattened
  }
}
