'use strict'

const {
  exposeManifest,
  exposePhysicalNode
} = require('./components/accessors')
const {
  hasConflictingBins,
  findAncestorMatching
} = require('./components/tree-analyzer')

function physicalTree ({bundledTo, optional, unlinked, dev, parent, logicalNode = {}}) {
  const state = {
    parent,
    dev,
    logicalNode,
    children: [],
    bundledTo,
    optional,
    unlinked
  }
  const self = Object.assign(
    {
      get root () {
        if (self.optional) {
          if (parent && parent.optional) return parent.root
          return self
        } else if (self.bundledTo) {
          return self.bundledTo
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
        const dev = !!(self.devDependencies.includes(name) || self.dev)
        const bundledTo = self.bundledTo || (self.bundleDependencies.includes(name) ? self : null)
        const treeRoot = bundledTo || self.root
        const parent = (ancestorMatch || (bin && hasConflictingBins(self, bin)))
          ? self
          : treeRoot
        const child = physicalTree(
          {bundledTo, parent, optional, dev, unlinked, logicalNode}
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
        logicalDescendants
          .filter(({child}) => !self.unlinked && !child.unlinked)
          .forEach(({child, children}) => {
            child.addChildren(children)
          })
      }
    },
    exposeManifest(state.logicalNode.manifest),
    exposePhysicalNode(state)
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
