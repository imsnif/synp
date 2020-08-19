const glob = require('bash-glob')

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
        cwd,
        realpath: true,
        ignore: '**/node_modules/**'
      }
    )
  }
}
