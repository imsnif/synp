'use strict'

function createPackageLockTree ({physicalTree}) {
  const logicalNode = physicalTree.logicalNode
  return {
    bundled: physicalTree.bundled || undefined,
    optional: physicalTree.optional || undefined,
    version: physicalTree.version,
    resolved: physicalTree.bundled ? undefined : physicalTree.manifest._resolved,
    integrity: physicalTree.bundled ? undefined : physicalTree.manifest._integrity,
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
