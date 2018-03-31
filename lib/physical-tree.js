'use strict'

function nmPhysicalTree ({manifest, parent = {}, bundledTo, optional}) {
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
      if (self.parent.findAncestorMatching) return self.parent.findAncestorMatching(name)
      return false
    },
    get isOptional () {
      return state.optional || parent.optional
    },
    addChildren (children) {
      const treeRoot = self.root
      let logicalChildren = []
      Object.keys(children).sort().forEach(childName => {
        const node = children[childName]
        const debugName = `${childName}@${node.manifest.version}`
        const isOptional = !!(state.manifest.optionalDependencies && state.manifest.optionalDependencies[childName]) || self.isOptional
        if (self.bundled) {
          // TODO: CONTINUE HERE - figure out why bundled node is getting different deps (uid-number)
          // console.log('adding node bundled:', debugName)
          const child = nmPhysicalTree({
            manifest: node.manifest,
            parent: bundledTo,
            optional: isOptional,
            bundledTo
          })
          if (bundledTo.children.find(c => c.manifest.name === child.manifest.name && c.manifest.version !== child.manifest.version)) {
            self.children.push(child)
          } else {
            bundledTo.children.push(child)
          }
          logicalChildren.push({child, children: node.children, debugName}) // TODO: betterify
        } else if (self.manifest.bundleDependencies && self.manifest.bundleDependencies.includes(childName)) {
          // console.log('adding node bundled:', debugName)
          const child = nmPhysicalTree({
            manifest: node.manifest,
            parent: self,
            bundledTo: self,
            optional: isOptional
          })
          state.children.push(child)
          logicalChildren.push({child, children: node.children, debugName}) // TODO: betterify
        } else {
          // TODO rewrite:
          // Find closest name match backwards recursively
          // 1. If it's the version I want, push my children to logical children and do onthing
          // 2. If it's not the version I want, add child to self and push logical children
          // 3. If I didn't find it, add to tree root and push logical children
          const ancestorMatch = self.findAncestorMatching(node.manifest.name)
          if (ancestorMatch && ancestorMatch.manifest.version === node.manifest.version) {
            logicalChildren.push({child: null, children: node.children, debugName}) // TODO: betterify
          } else if (ancestorMatch) {
            const child = nmPhysicalTree({
              manifest: node.manifest,
              parent: self,
              optional: isOptional
            })
            state.children.push(child)
            logicalChildren.push({child, children: node.children, debugName}) // TODO: betterify
          } else {
            const child = nmPhysicalTree({
              manifest: node.manifest,
              parent: treeRoot,
              optional: isOptional
            })
            treeRoot.children.push(child)
            logicalChildren.push({child, children: node.children, debugName}) // TODO: betterify
          }

          // if (self.hasAccessTo(node.manifest.name, node.manifest.version)) {
          //   logicalChildren.push({child: null, children: node.children, debugName}) // TODO: betterify
          //   return
          // }
          // const child = nmPhysicalTree({
          //   manifest: node.manifest,
          //   parent: self,
          //   optional: isOptional
          // })
          // logicalChildren.push({child, children: node.children, debugName}) // TODO: betterify
          // if (treeRoot.children.find(c => c.manifest.name === node.manifest.name) || hasConflictingBins(treeRoot, node)) {
          // // if (differentVersionInPath(node, self) || hasConflictingBins(treeRoot, node)) {
          // // if (differentVersionInPath(node, self)) {
          //   // TODO: CONTINUE HERE - investigate this, find out how to get string-width@1.0.2 to be added properly to cliui@3.2.0 (look in lock files)
          //   // console.log('adding node to self:', debugName)
          //   // by now we are certain the child at the root node is a different version
          //   // so we need to add it here
          //   state.children.push(child)
          // } else {
          //   child.reParent(treeRoot) // TODO: like a normal person
          //   // console.log('adding node to tree root:', debugName)
          //   treeRoot.children.push(child)
          // }
        }
      })
      logicalChildren.forEach(({child, children, debugName}) => {
        // console.log(`addingChildren for ${debugName}`, Object.keys(children).map(childName => `${childName}@${children[childName].manifest.version}`))
        if (child) {
          child.addChildren(children)
        } else {
          const treeRoot = self.root
          let logicalGrandchildren = []
          Object.keys(children).sort().forEach(childName => {
            const node = children[childName]
            if (treeRoot.children.find(c => c.manifest.name === childName)) {
            } else {
              const debugName = `${childName}@${node.manifest.version}`
              // console.log('adding node to tree root:', debugName)
              const child = nmPhysicalTree({
                manifest: node.manifest,
                parent: treeRoot
                // optional: isOptional // TODO
              })
              treeRoot.children.push(child)
              logicalGrandchildren.push({child, children: node.children, debugName}) // TODO: betterify
            }
          })
          logicalGrandchildren.forEach(({child, children, debugName}) => {
            // console.log(`addingChildren for ${debugName}`, Object.keys(children).map(childName => `${childName}@${children[childName].manifest.version}`))
            child.addChildren(children)
          })
        }
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
    optional
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
