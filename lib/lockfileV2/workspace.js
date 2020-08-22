'use strict'

const glob = require('bash-glob')
const { sep, resolve } = require('path')

module.exports = {
  getWorkspaces (manifest, cwd) {
    let packages = manifest.workspaces
    if (packages && packages.packages) {
      packages = packages.packages
    }

    // Turn workspaces into list of package.json files.
    return glob.sync(
      packages.map((p) => p.replace(/\/?$/, '/package.json')),
      {
        cwd: resolve(cwd),
        realpath: true,
        ignore: '**/node_modules/**'
      }
    )
  },
  npmEntryFromWorkspace (workspacesTree, name, modulesInPath, basePath) {
    if (workspacesTree && workspacesTree[name] && modulesInPath.length === 1) {
      return {
        version: `file:${workspacesTree[name].pkgPath.split(sep).slice(basePath.length).join(sep)}`
      }
    }
  }
}
