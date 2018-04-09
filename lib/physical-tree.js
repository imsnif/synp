'use strict'

function nmPhysicalTree ({bundled, optional, unlinked, dev, logicalNode = {}, parent = false}) {
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
    get devDependencies () {
      return state.manifest.devDependencies || []
    },
    get children () {
      return state.children
    },
    get logicalNode () {
      return state.logicalNode
    },
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
      const root = self.root
      if (root.name === self.name && root.version === self.version) return false
      if (parent) return parent._hasConflictingBins(bins)
      return false
    },
    get optional () {
      if (parent) return state.optional || parent.optional
      return state.optional
    },
    get dev () {
      if (parent) return state.dev || parent.dev
      return state.dev
    },
    get bundled () {
      if (parent) return state.bundled || parent.bundled
      return state.bundled
    },
    findAncestorMatching (name) {
      const matchingChild = self.children.find(c => c.name === name)
      if (matchingChild) return matchingChild
      const root = self.root
      if (root.name === self.name && root.version === self.version) return false
      if (parent) return parent.findAncestorMatching(name)
      return false
    },
    addChild (logicalNode) {
      const { name, version, bin } = logicalNode.manifest
      const ancestorMatch = self.findAncestorMatching(name)
      const unlinked = !!(ancestorMatch && ancestorMatch.version === version)
      const optional = !!(self.optionalDependencies[name] || self.optional)
      const bundled = !!(self.bundleDependencies.includes(name))
      const dev = !!(self.devDependencies.includes(name) || self.dev)
      const treeRoot = bundled ? self : self.root
      const parent = (ancestorMatch || self._hasConflictingBins(bin)) ? self : treeRoot
      const child = nmPhysicalTree({parent, optional, dev, bundled, unlinked, logicalNode})
      if (!self.unlinked && !child.unlinked) parent.children.push(child)
      return child
    },
    addChildren (logicalDependencies) {
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
    manifest: logicalNode.manifest || {}, // TODO: do we still need this?
    dev,
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
    const tree = nmPhysicalTree({logicalNode: logicalTree})
    tree.addChildren(logicalTree.dependencies)
    return tree
  }
}
