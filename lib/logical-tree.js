'use strict'

const logicalTree = require('npm-logical-tree')
const { stringManifestFetcher } = require('./manifest-fetcher')

function nmLogicalTree ({manifest, flatTree, yarnObject, parent = {}, nodes = {}}) {
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
    get children () {
      return state.children
    },
    get nodes () {
      return state.nodes
    },
    addParent (parent) {
      state.parents.push(parent)
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
    nodes
  }
  return self
}

module.exports = {
  async createLogicalTreeNpm ({packageJson, packageLock}) {
    const getManifest = stringManifestFetcher()
    const tree = logicalTree(
      packageJson,
      packageLock
    )
    await tree.forEachAsync(async (node, cb) => {
      const manifest = node.isRoot
      ? Object.assign({}, packageJson, {
        dependencies: Object.assign({}, packageJson.devDependencies || {}, packageJson.optionalDependencies || {}, packageJson.dependencies || {})
      })
      : await getManifest(`${node.name}@${node.version}`)
      node.manifest = manifest
      await cb()
    })
    return tree
  },
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
