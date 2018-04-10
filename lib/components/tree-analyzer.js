'use strict'

function getAncestorChain (tree, root) {
  if (
    !tree.parent ||
    (root.name === tree.name && root.version === tree.version)
  ) return [tree]
  return [].concat(tree, getAncestorChain(tree.parent, root))
}

module.exports = {
  hasConflictingBins (tree, bins) {
    const root = tree.root
    const ancestorChain = getAncestorChain(tree, root)
    return ancestorChain.some(t => t.children.some(child => {
      if (!child.bin) return false
      return Object.keys(child.bin).some(bin => bins[bin])
    }))
  },
  findAncestorMatching (tree, name) {
    const root = tree.root
    const ancestorChain = getAncestorChain(tree, root)
    return ancestorChain.reduce((found, ancestor) => {
      if (found) return found
      return ancestor.children.find(c => c.name === name)
    }, null)
  }
}
