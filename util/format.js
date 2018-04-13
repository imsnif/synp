'use strict'

const jsonStringify = require('json-stable-stringify')

module.exports = {
  formatYarnResolved (resolved, shasum) {
    if (/^\//.test(resolved)) return // no resolved for file dependencies
    if (/^git/.test(resolved)) return resolved
    // github urls use their branch checksum
    return `${resolved}#${shasum}`
  },
  stringifyPackageLock ({packageLock, packageJson}) {
    const { name, version } = packageJson
    const keyPriorities = {
      name: 1,
      version: 2,
      resolved: 3,
      integrity: 4,
      dev: 5,
      bundled: 6,
      optional: 7,
      lockfileVersion: 8,
      requires: 9,
      dependencies: 10
    }
    return jsonStringify(Object.assign({}, packageLock, {
      name,
      version,
      lockfileVersion: 1,
      requires: true
    }), {
      space: 2,
      cmp: (a, b) => {
        const aPriority = keyPriorities[a.key]
        const bPriority = keyPriorities[b.key]
        if (aPriority && bPriority) {
          return aPriority < bPriority ? -1 : 1
        } else {
          return a.key < b.key ? -1 : 1
        }
      }
    })
  }
}
