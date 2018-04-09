'use strict'

const logicalTree = require('npm-logical-tree')
const { yarnLogicalTree } = require('../test/utils/logical-tree')
const { stringManifestFetcher } = require('./manifest-fetcher')

module.exports = {
  async createLogicalTreeNpm ({packageJson, packageLock}) {
    const getManifest = stringManifestFetcher()
    const tree = logicalTree(
      packageJson,
      packageLock
    )
    await tree.forEachAsync(async (node, cb) => {
      const manifest = node.isRoot
      ? Object.assign({}, packageJson, {
        dependencies: Object.assign({}, packageJson.devDependencies || {}, packageJson.optionalDependencies || {}, packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {}),
        optionalDependencies: packageJson.optionalDependencies || {}
      })
      : await getManifest(`${node.name}@${node.version}`)
      node.manifest = manifest
      await cb()
    })
    return tree
  },
  async createLogicalTreeYarn ({packageJson, yarnLock}) {
    const getManifest = stringManifestFetcher()
    const tree = yarnLogicalTree(
      packageJson,
      yarnLock
    )
    await tree.forEachAsync(async (node, cb) => {
      const manifest = node.isRoot
      ? Object.assign({}, packageJson, {
        dependencies: Object.assign({}, packageJson.devDependencies || {}, packageJson.optionalDependencies || {}, packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {}),
        optionalDependencies: packageJson.optionalDependencies || {}
      })
      : await getManifest(`${node.name}@${node.version}`)
      node.manifest = node.isRoot
        ? manifest
        : Object.assign({}, manifest, {devDependencies: []})
      await cb()
    })
    return tree
  }
}
