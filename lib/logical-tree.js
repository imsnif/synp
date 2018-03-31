'use strict'

function nmLogicalTree ({manifest, flatTree, yarnObject, parent = {}, nodes = {}}) {
  const self = Object.freeze({
    get manifest () {
      return state.manifest
    },
    get children () {
      return state.children
    },
    get nodes () {
      return state.nodes
    },
    get nodeArray () {
      return Object.keys(state.nodes).map(nodeName => state.nodes[nodeName])
    },
    get parents () {
      return state.parents
    },
    findNode (id) {
      const directChild = self.children.find(c => c.manifest._id === id)
      if (directChild) return directChild
      return self.deepChildren.find(c => c.manifest._id === id)
    },
    toObject () {
      return {
        manifest: state.manifest,
        children: state.children.map(c => c.toObject())
      }
    },
    addParent (parent) {
      state.parents.push(parent)
      if (parent.lowestAncestorCount < state.lowestAncestorCount) {
        state.lowestAncestorCount = parent.lowestAncestorCount
      }
    },
    get lowestAncestorCount () {
      return state.lowestAncestorCount
    },
    addChild (name, semverString) {
      const childVersion = yarnObject[`${name}@${semverString}`].version
      const childManifest = flatTree[name][childVersion]
      if (state.nodes[childManifest._id]) {
        state.nodes[childManifest._id].addParent(self)
        state.children[name] = state.nodes[childManifest._id]
      } else {
        nodes[childManifest._id] = nmLogicalTree({
          manifest: childManifest,
          flatTree,
          yarnObject,
          parent: self,
          nodes
        })
        state.children[name] = nodes[childManifest._id]
        Object.keys(childManifest.dependencies).forEach(depName => {
          const depSemver = childManifest.dependencies[depName]
          state.children[name].addChild(depName, depSemver)
        })
      }
    }
  })
  const state = {
    manifest,
    children: {},
    parents: [parent],
    lowestAncestorCount: parent && parent.toObject ? parent.lowestAncestorCount + 1 : 0,
    nodes
  }
  return self
}

module.exports = {
  createLogicalTree ({packageJson, flatTree, yarnObject}) {
    const manifest = Object.assign({}, packageJson, {
      dependencies: Object.assign({}, packageJson.devDependencies || {}, packageJson.optionalDependencies || {}, packageJson.dependencies || {})
    })
    const tree = nmLogicalTree({manifest, flatTree, yarnObject})
    Object.keys(manifest.dependencies).forEach(depName => {
      const depSemver = manifest.dependencies[depName]
      tree.addChild(depName, depSemver)
    })
    return tree
  }
}
