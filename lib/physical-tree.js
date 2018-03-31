'use strict'

function nmPhysicalTree ({manifest, parent = {}, bundledTo, optional, unlinked}) {
  const self = Object.freeze({
    get manifest () {
      return state.manifest
    },
    get children () {
      return state.children
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
        if (!child.manifest.bin) return false
        return Object.keys(child.manifest.bin).some(bin => bins[bin])
      })) return true
      if (self.parent._hasConflictingBins) {
        const bundled = self.bundled
        if (bundled && self.manifest.name === bundled.manifest.name && bundled.manifest.version === self.manifest.version) return false
        return self.parent._hasConflictingBins(bins)
      }
      return false
    },
    get isRoot () {
      if (parent.manifest) return false
      return true
    },
    get deepChildren () {
      const children = state.children.reduce((children, c) => children.concat(c.deepChildren), [])
      return children.concat(self)
    },
    findAncestorNode (name) {
      const childNodeMatch = state.children.find(n => n.manifest.name === name)
      if (childNodeMatch) {
        return childNodeMatch
      } else if (parent.findAncestorNode) {
        return parent.findAncestorNode(name)
      } else {
        return null
      }
    },
    findNode (name, version) {
      const children = state.children.reduce(c => c.deepChildren, [])
      return children.find(c => c.name === name && c.version === version)
    },
    hasAccessTo (name, version) {
      if (self.children.find(c => c.manifest.name === name && c.manifest.version === version)) return true
      if (state.parent.hasAccessTo) return state.parent.hasAccessTo(name, version)
      return false
    },
    unlinkChild (name) {
      state.children = state.children.filter(c => c.manifest.name !== name)
    },
    get unlinked () {
      return state.unlinked || parent.unlinked
    },
    setUnlinked () {
      state.unlinked = true
    },
    reParent (parent) {
      state.parent = parent
    },
    get ancestorCount () {
      // TODO: consider caching this
      if (parent.manifest) return parent.ancestorCount + 1
      return 0
    },
    get bundled () {
      return state.bundledTo || parent.bundled
    },
    findAncestorMatching (name) {
      const matchingChild = self.children.find(c => c.manifest.name === name)
      if (matchingChild) return matchingChild
      // if (self.parent.findAncestorMatching) return self.parent.findAncestorMatching(name)
      if (self.parent.findAncestorMatching) {
        const bundled = self.bundled
        if (bundled && self.manifest.name === bundled.manifest.name && bundled.manifest.version === self.manifest.version) return false
        return self.parent.findAncestorMatching(name)
      }
      return false
    },
    get isOptional () {
      return state.optional || parent.optional
    },
    addChild (node) {
      const treeRoot = self.bundled || self.root
      const name = node.manifest.name
      const isOptional = !!(state.manifest.optionalDependencies && state.manifest.optionalDependencies[name])
      const bundledTo = self.bundled || self.manifest.bundleDependencies && self.manifest.bundleDependencies.includes(name) ? self : undefined
      const ancestorMatch = self.findAncestorMatching(node.manifest.name)
      const parent = ancestorMatch || self._hasConflictingBins(node.manifest.bin) ? self : bundledTo || treeRoot
      const child = nmPhysicalTree({
        manifest: node.manifest,
        parent,
        optional: isOptional,
        bundledTo,
        unlinked: ancestorMatch && ancestorMatch.manifest.version === node.manifest.version
      })
      if (!self.unlinked && !child.unlinked) parent.children.push(child)
      return {child, children: node.children} // TODO: betterify
    },
    addChildren (children) {
      const treeRoot = self.bundled || self.root
      const logicalDescendants = Object.keys(children).sort().reduce((logicalDescendants, childName) => {
        const node = children[childName]
        const descendants = self.unlinked && treeRoot.children.some(c => c.manifest.name === childName) ? [] : self.addChild(node)
        return logicalDescendants.concat(descendants)
      }, [])
      logicalDescendants.forEach(({child, children}) => {
        child.addChildren(children)
      })
    },
    get parent () {
      return parent
    },
    toObject () {
      return {
        unlinked: false,
        manifest: state.manifest,
        children: state.children.map(c => c.toObject())
      }
    }
  })
  const state = {
    manifest: Object.assign({}, manifest, {_id: manifest._id || `${manifest.name}@${manifest.version}`}),
    children: [],
    parent,
    bundledTo,
    optional,
    unlinked
  }
  return self
}

module.exports = {
  createPhysicalTree ({manifest, flatTree, logicalTree}) {
    const tree = nmPhysicalTree({manifest, flatTree, logicalTree})
    Object.keys(logicalTree.children)
      .sort()
      .forEach(childName => tree.addChildren(logicalTree.children))
    return tree
  }
}
