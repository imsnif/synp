'use strict'

function nmPhysicalTree ({bundled, optional, unlinked, logicalNode = {}, parent = false}) {
  const self = Object.freeze({
    get manifest () {
      return state.manifest
    },
    get name () {
      return state.manifest.name
    },
    get version () {
      return state.manifest.version
    },
    get bin () {
      return state.manifest.bin
    },
    get optionalDependencies () {
      return state.manifest.optionalDependencies || {}
    },
    get bundleDependencies () {
      return state.manifest.bundleDependencies || []
    },
    get children () {
      return state.children
    },
    get logicalNode () {
      return state.logicalNode
    },
    get root () {
      if (self.bundled) return self
      if (parent) return parent.root
      return self
    },
    get isRoot () {
      if (self.bundled) return true
      if (parent) return false
      return true
    },
    get unlinked () {
      if (parent) return state.unlinked || parent.unlinked
      return state.unlinked
    },
    _hasConflictingBins (bins) {
      if (!bins) return false
      if (self.children.some(child => {
        if (!child.bin) return false
        return Object.keys(child.bin).some(bin => bins[bin])
      })) return true
      if (self.isRoot) return false
      if (parent) return parent._hasConflictingBins(bins)
      return false
    },
    get bundled () {
      if (parent) return state.bundled || parent.bundled
      return state.bundled
    },
    findAncestorMatching (name) {
      const matchingChild = self.children.find(c => c.name === name)
      if (matchingChild) return matchingChild
      if (self.isRoot) return false
      if (parent) return parent.findAncestorMatching(name)
      return false
    },
    addChild (logicalNode) {
      const { name, version, bin } = logicalNode.manifest
      const { dependencies } = logicalNode
      const ancestorMatch = self.findAncestorMatching(name)
      const unlinked = !!(ancestorMatch && ancestorMatch.version === version)
      const optional = !!(self.optionalDependencies[name])
      const bundled = !!(self.bundleDependencies.includes(name))
      const treeRoot = self.root
      const parent = (ancestorMatch || self._hasConflictingBins(bin)) ? self : treeRoot
      const child = nmPhysicalTree({parent, optional, bundled, unlinked, logicalNode})
      if (!self.unlinked && !child.unlinked) parent.children.push(child)
      return child
    },
    addChildren (logicalDependencies) {
      const treeRoot = self.root
      const logicalDescendants = Array.from(logicalDependencies.keys())
        .sort()
        .reduce((logicalDescendants, childName) => {
          const logicalNode = logicalDependencies.get(childName)
          const child = self.addChild(logicalNode)
          if (!self.unlinked) {
            logicalDescendants.push({child, children: logicalNode.dependencies})
          }
          return logicalDescendants
        }, [])
      logicalDescendants.forEach(({child, children}) => {
        child.addChildren(children)
      })
    }
  })
  const state = {
    manifest: logicalNode.manifest || {},
    logicalNode,
    children: [],
    bundled,
    optional,
    unlinked
  }
  return self
}

module.exports = {
  createPhysicalTree ({logicalTree}) {
    const tree = nmPhysicalTree({logicalTree})
    tree.addChildren(logicalTree.dependencies)
    return tree
  }
}
