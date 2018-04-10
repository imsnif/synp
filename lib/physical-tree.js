'use strict'

const { exposeManifest, exposePhysicalNode } = require('./components/accessors')
const { hasConflictingBins, findAncestorMatching } = require('./components/tree-analyzer')

function physicalTree ({bundled, optional, unlinked, dev, logicalNode = {}, parent = false}) {
  const state = {
    dev,
    logicalNode,
    children: [],
    bundled,
    optional,
    unlinked
  }
  const self = Object.assign(
    {
      get root () {
        if (self.optional) {
          if (parent && parent.optional) return parent.root
          return self
        } else if (self.bundled) {
          if (parent && parent.bundled) return parent.root
          if (parent) return parent
          return self
        } else {
          if (parent) return parent.root
          return self
        }
      },
      addChild (logicalNode) {
        const { name, version, bin } = logicalNode.manifest
        const ancestorMatch = findAncestorMatching(self, name)
        const unlinked = !!(ancestorMatch && ancestorMatch.version === version)
        const optional = !!(self.optionalDependencies[name] || self.optional)
        const bundled = !!(self.bundleDependencies.includes(name))
        const dev = !!(self.devDependencies.includes(name) || self.dev)
        const treeRoot = bundled ? self : self.root
        const parent = (ancestorMatch || (bin && hasConflictingBins(self, bin)))
          ? self
          : treeRoot
        const child = physicalTree(
          {parent, optional, dev, bundled, unlinked, logicalNode}
        )
        if (!self.unlinked && !child.unlinked) parent.children.push(child)
        return child
      },
      addChildren (logicalDependencies) {
        const logicalDescendants = Array.from(logicalDependencies.keys())
          .sort()
          .reduce((logicalDescendants, childName) => {
            const logicalNode = logicalDependencies.get(childName)
            const child = self.addChild(logicalNode)
            logicalDescendants.push({child, children: logicalNode.dependencies})
            return logicalDescendants
          }, [])
        if (!self.unlinked) {
          logicalDescendants.forEach(({child, children}) => {
            child.addChildren(children)
          })
        }
      }
    },
    exposeManifest(state.logicalNode.manifest),
    exposePhysicalNode(state, parent)
  )
  return Object.freeze(self)
}

module.exports = {
  createPhysicalTree ({logicalTree}) {
    const tree = physicalTree({logicalNode: logicalTree})
    tree.addChildren(logicalTree.dependencies)
    return tree
  }
}
