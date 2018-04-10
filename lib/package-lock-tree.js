'use strict'

function createPackageLockTree ({physicalTree}) {
  const logicalNode = physicalTree.logicalNode
  const githubVersion = /^git+/.test(logicalNode.resolved) ? logicalNode.resolved : false
  return {
    bundled: physicalTree.bundled || undefined,
    optional: physicalTree.optional || undefined,
    dev: physicalTree.dev || undefined,
    version: githubVersion || physicalTree.version,
    resolved: physicalTree.bundled || githubVersion
      ? undefined
      : physicalTree.manifest._resolved,
    integrity: physicalTree.bundled || githubVersion
      ? undefined
      : physicalTree.manifest._integrity,
    requires: logicalNode.dependencies && logicalNode.dependencies.size > 0
      ? Array.from(logicalNode.dependencies.keys()).reduce((requires, name) => {
        const childNode = logicalNode.dependencies.get(name)
        const version = childNode.manifest.version
        requires[name] = version
        return requires
      }, {})
      : undefined,
    dependencies: physicalTree.children.length > 0
      ? physicalTree.children.reduce((dependencies, physicalChild) => {
        dependencies[physicalChild.name] = createPackageLockTree({
          physicalTree: physicalChild
        })
        return dependencies
      }, {})
      : undefined
  }
}

module.exports = { createPackageLockTree }
