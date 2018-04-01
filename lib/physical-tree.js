'use strict'

function nmPhysicalTree ({parent = {}, bundledTo, optional, unlinked, logicalNode = {}}) {
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
    get parent () {
      return parent
    },
    get optionalDependencies () {
      return state.manifest.optionalDependencies
    },
    get bundleDependencies () {
      return state.manifest.bundleDependencies
    },
    get children () {
      return state.children
    },
    get logicalNode () {
      return state.logicalNode
    },
    get root () {
      if (parent.manifest) return parent.root
      return self
    },
    get unlinked () {
      return state.unlinked || parent.unlinked
    },
    _hasConflictingBins (bins) {
      if (!bins) return false
      if (self.children.some(child => {
        if (!child.bin) return false
        return Object.keys(child.bin).some(bin => bins[bin])
      })) return true
      if (self.parent._hasConflictingBins) {
        const bundled = self.bundled
        if (bundled && self.name === bundled.name && bundled.version === self.version) return false
        return self.parent._hasConflictingBins(bins)
      }
      return false
    },
    get bundled () {
      return state.bundledTo || parent.bundled
    },
    findAncestorMatching (name) {
      const matchingChild = self.children.find(c => c.name === name)
      if (matchingChild) return matchingChild
      if (self.parent.findAncestorMatching) {
        const bundled = self.bundled
        if (bundled && self.name === bundled.name && bundled.version === self.version) return false
        return self.parent.findAncestorMatching(name)
      }
      return false
    },
    addChild (node) {
      const treeRoot = self.bundled || self.root
      const name = node.name
      const isOptional = !!(self.optionalDependencies && self.optionalDependencies[name])
      const bundledTo = self.bundled || self.bundleDependencies && self.bundleDependencies.includes(name) ? self : undefined
      const ancestorMatch = self.findAncestorMatching(node.name)
      const parent = ancestorMatch || self._hasConflictingBins(node.bin) ? self : bundledTo || treeRoot
      const child = nmPhysicalTree({
        manifest: node.manifest,
        parent,
        optional: isOptional,
        bundledTo,
        unlinked: ancestorMatch && ancestorMatch.version === node.version,
        logicalNode: node
      })
      if (!self.unlinked && !child.unlinked) parent.children.push(child)
      return {child, children: node.children} // TODO: betterify
    },
    addChildren (children) {
      const treeRoot = self.bundled || self.root
      const logicalDescendants = Object.keys(children).sort().reduce((logicalDescendants, childName) => {
        const node = children[childName]
        const descendants = self.unlinked && treeRoot.children.some(c => c.name === childName) ? [] : self.addChild(node)
        return logicalDescendants.concat(descendants)
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
    parent,
    bundledTo,
    optional,
    unlinked
  }
  return self
}

module.exports = {
  createPhysicalTree ({logicalTree}) {
    const tree = nmPhysicalTree({logicalTree})
    Object.keys(logicalTree.children)
      .sort()
      .forEach(childName => tree.addChildren(logicalTree.children))
    return tree
  }
}
