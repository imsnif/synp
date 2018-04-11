'use strict'

const logicalTree = require('npm-logical-tree')
const yarnLogicalTree = require('yarn-logical-tree')
const { manifestFetcher } = require('./manifest-fetcher')

function formatPackageJson (packageJson) {
  return Object.assign({}, packageJson, {
    dependencies: Object.assign(
      {},
      packageJson.devDependencies || {},
      packageJson.optionalDependencies || {},
      packageJson.dependencies || {}
    ),
    devDependencies: Object.keys(packageJson.devDependencies || {}),
    optionalDependencies: packageJson.optionalDependencies || {}
  })
}

module.exports = {
  async createLogicalTree ({packageJson, packageLock, yarnLock}) {
    const getManifest = manifestFetcher()
    const tree = packageLock
      ? logicalTree(
        packageJson,
        packageLock
      )
      : yarnLogicalTree(
        packageJson,
        yarnLock
      )
    await tree.forEachAsync(async (node, cb) => {
      const manifest = node.isRoot
        ? formatPackageJson(packageJson)
        : Object.assign(
          {},
          await getManifest(`${node.name}@${node.version}`),
          {devDependencies: []}
        )
      node.manifest = manifest
      await cb()
    })
    return tree
  }
}
