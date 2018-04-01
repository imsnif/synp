'use strict'

function packageLockTree ({physicalTree, parent = {}}) {
  const self = Object.freeze({
    get name () {
      return state.name
    },
    get children () {
      return state.children
    },
    get root () {
      if (parent.manifest) return parent.root
      return self
    },
    get isRoot () {
      if (parent.manifest) return false
      return true
    },
    get deepChildren () {
      const children = state.children.reduce((children, c) => children.concat(c.deepChildren), [])
      return children.concat(self)
    },
    findNode (name, version) {
      const children = state.children.reduce(c => c.deepChildren, [])
      return children.find(c => c.name === name && c.version === version)
    },
    toObject () {
      return {
        optional: state.optional,
        bundled: state.bundled,
        version: state.version,
        resolved: state.resolved,
        integrity: state.integrity,
        requires: state.requires,
        dependencies: state.children && state.children.length > 0
          ? state.children.reduce((dependencies, c) => {
            dependencies[c.name] = c.toObject()
            return dependencies
          }, {})
          : undefined
      }
    }
  })
  const logicalNode = physicalTree.logicalNode
  const state = {
    optional: physicalTree.isOptional,
    bundled: !!physicalTree.bundled || undefined,
    name: physicalTree.name,
    version: physicalTree.version,
    resolved: physicalTree.bundled ? undefined : physicalTree.manifest._resolved,
    integrity: physicalTree.bundled ? undefined : physicalTree.manifest._integrity,
    requires: logicalNode.children && Object.keys(logicalNode.children).length > 0
      ? Object.keys(logicalNode.children).reduce((requires, name) => {
        const childNode = logicalNode.children[name]
        const version = childNode.version
        requires[name] = version
        return requires
      }, {})
      : undefined,
    children: physicalTree.children.length > 0
      ? physicalTree.children.map(c => {
        return packageLockTree({physicalTree: c, parent: self})
      })
      : []
  }
  return self
}

module.exports = { packageLockTree }
