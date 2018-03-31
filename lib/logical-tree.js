'use strict'

const fs = require('fs')
const path = require('path')
const lockfile = require('@yarnpkg/lockfile')
const eol = require('eol')
const logicalTree = require('npm-logical-tree')

const cliProgress = require('cli-progress')

const jsonStringify = require('json-stable-stringify')

const { yarnTree } = require('./lib/yarn-tree')
const { npmTree } = require('./lib/npm-tree')
const { createTreeManifest } = require('./lib/tree-manifest')

function getTreeSize (nodeModulesTree) {
  let counter = 0
  nodeModulesTree.forEach((node, cb) => {
    counter++
    cb()
  })
  return counter
}

function createProgressBar (nodeModulesTree) {
  const treeSize = getTreeSize(nodeModulesTree)
  const bar = new cliProgress.Bar({clearOnComplete: true}, cliProgress.Presets.shades_classic)
  bar.start(treeSize, 0)
  return bar
}

function buildLogicalTree (packageDir) {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8')
  )
  const packageLock = JSON.parse(
    fs.readFileSync(
      path.join(packageDir, 'package-lock.json'),
      'utf-8'
    )
  )
  const nodeModulesTree = logicalTree(
    packageJson,
    packageLock
  )
  return { packageJson, packageLock, nodeModulesTree }
}

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
    addChild(name, semverString) {
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

function hasConflictingBins (tree, node) {
  // return false
  if (!node.manifest.bin) return false
  return tree.children.some(child => {
    if (!child.manifest.bin) return false
    return Object.keys(child.manifest.bin).some(bin => node.manifest.bin[bin])
  })
}

function differentVersionInPath (node, self) {
  if (self.manifest.name === 'cliui') {
    console.log('looking for:', node.manifest.name)
  }
  if (self.children.find(c => c.manifest.name === node.manifest.name)) {
    return true
  } else if (self.parent && self.parent.children) {
    return differentVersionInPath(node, self.parent)
  } else {
    return false
  }
}

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
    setUnlinked() {
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

//          if (self.hasAccessTo(node.manifest.name, node.manifest.version)) {
//            logicalChildren.push({child: null, children: node.children, debugName}) // TODO: betterify
//            return
//          }
//          const child = nmPhysicalTree({
//            manifest: node.manifest,
//            parent: self,
//            optional: isOptional
//          })
//          logicalChildren.push({child, children: node.children, debugName}) // TODO: betterify
//          if (treeRoot.children.find(c => c.manifest.name === node.manifest.name) || hasConflictingBins(treeRoot, node)) {
//          // if (differentVersionInPath(node, self) || hasConflictingBins(treeRoot, node)) {
//          // if (differentVersionInPath(node, self)) {
//            // TODO: CONTINUE HERE - investigate this, find out how to get string-width@1.0.2 to be added properly to cliui@3.2.0 (look in lock files)
//            // console.log('adding node to self:', debugName)
//            // by now we are certain the child at the root node is a different version
//            // so we need to add it here
//            state.children.push(child)
//          } else {
//            child.reParent(treeRoot) // TODO: like a normal person
//            // console.log('adding node to tree root:', debugName)
//            treeRoot.children.push(child)
//          }
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
              return 
            } else {
              const debugName = `${childName}@${node.manifest.version}`
              // console.log('adding node to tree root:', debugName)
              const child = nmPhysicalTree({
                manifest: node.manifest,
                parent: treeRoot,
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

function createLogicalTree ({packageJson, flatTree, yarnObject}) {
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

function createPhysicalTree ({manifest, flatTree, logicalTree}) {
  const tree = nmPhysicalTree({manifest, flatTree, logicalTree})
  Object.keys(logicalTree.children)
  .sort()
  .forEach(childName => tree.addChildren(logicalTree.children))
  return tree
}

function priorityOf (keyName) {
  if (keyName === 'name') return 1
  if (keyName === 'version') return 2
  if (keyName === 'resolved') return 3
  if (keyName === 'integrity') return 4
  if (keyName === 'bundled') return 5
  if (keyName === 'optional') return 6
  if (keyName === 'lockfileVersion') return 7
  if (keyName === 'requires') return 8
  if (keyName === 'dependencies') return 9
}

module.exports = {
  async yarnToNpm (packageDir) {
    const yarnLock = fs.readFileSync(
      path.join(packageDir, 'yarn.lock'),
      'utf-8'
    )
    const yarnLockNormalized = eol.lf(yarnLock)
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8')
    )
    const yarnObject = lockfile.parse(yarnLockNormalized).object
    // TODO:
    // 1. create flatTree => [ {<pkgName>: [ {<version>: <manifest>} ] } ... ] - DONE!
    // 2. create logicalTree => [ {<pkgName>: { manifest: <manifest>, children: [ <manifest> ] } ] - DONE!
    // 3. create physicalTree => [ {<pkgName>: { manifest: <manifest>, children: [ <manifest> ] } ]
    //
    // 4. package-lock.json => get physical tree, and add fields (for requires, loop through its manifest deps and check in the 'global' manifest)
    try {
      console.log('creating flat tree')
      const flatTree = await createTreeManifest({manifest: packageJson, yarnObject}) // TODO: name
//      fs.writeFileSync('/home/aram/backup/flat-tree.json', JSON.stringify(flatTree, false, 2))
      // const flatTree = require('/home/aram/backup/flat-tree.json')
      const logicalTree = createLogicalTree({packageJson, flatTree, yarnObject})
      console.log('created logical tree')
      const physicalTree = createPhysicalTree({manifest: packageJson, flatTree, logicalTree})
      console.log('created physical tree')
      const packageLock = packageLockTree({physicalTree, logicalTree})
      console.log('created packageLock')
      const { name, version } = packageJson
      return jsonStringify(Object.assign({}, packageLock.toObject(), {
        name,
        version,
        lockfileVersion: 1,
        requires: true
      }), {space: 2, cmp: (a, b) => {
        const aPriority = priorityOf(a.key)
        const bPriority = priorityOf(b.key)
        if (aPriority && bPriority) {
          return aPriority < bPriority ? -1 : 1
        } else {
          return a.key < b.key ? -1 : 1
        }
      }})
    } catch (e) {
      throw e
    }
  },
  async npmToYarn (packageDir) {
    const { packageJson, nodeModulesTree } = buildLogicalTree(packageDir)
    const bar = createProgressBar(nodeModulesTree)
    try {
      let tree = yarnTree(nodeModulesTree, packageJson)
      await nodeModulesTree.forEachAsync(async (node, cb) => {
        await tree.addEntry(node)
        bar.increment()
        await cb()
      })
      const yarnObj = tree.toObject()
      bar.stop()
      return lockfile.stringify(yarnObj)
    } catch (e) {
      bar.stop()
      throw e
    }
  }
}
