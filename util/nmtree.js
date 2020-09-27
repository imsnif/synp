'use strict'

const nmtree = require('nmtree')
const semver = require('semver')

module.exports = {
  nmtree (packageDir) {
    const tree = nmtree(packageDir)

    // Normalize composite versions
    // https://github.com/imsnif/synp/issues/53
    Object.values(tree).forEach(entry => {
      if (entry) {
        const semVersion = semver.parse(entry.version)
        entry.version = (semVersion && semVersion.version) || entry.version
      }
    })

    return tree
  }
}
