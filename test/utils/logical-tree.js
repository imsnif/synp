'use strict'

const logicalTree = require('npm-logical-tree')
const makeNode = logicalTree.node

// TODO: SEPARATE MODULE

module.exports = {
  yarnLogicalTree (pkg, yarnLock, opts) {
    const tree = makeNode(pkg.name, null, pkg)
    const allDeps = new Map()
    const allPackages = Object.assign({}, pkg.devDependencies || {}, pkg.optionalDependencies || {}, pkg.dependencies || {}) // TODO: name
    Object.keys(allPackages)
      .forEach(name => {
        let dep = allDeps.get(name)
        if (!dep) {
          const semverString = allPackages[name]
          const depNode = yarnLock[`${name}@${semverString}`]
          dep = {node: makeNode(name, name, depNode), semverString}
        }
        addChild(dep, {node: tree}, allDeps, yarnLock)
      })
    return tree
  },
  npmLogicalTree: logicalTree
}

function addChild (dep, treeNode, allDeps, yarnLock) {
  const tree = treeNode.node
  const { node, semverString } = dep
  tree.addDep(node)
  allDeps.set(`${node.name}@${semverString}`, dep)
  const lockNode = yarnLock[`${node.name}@${semverString}`]
  const dependencies = Object.assign({}, lockNode.optionalDependencies || {}, lockNode.dependencies || {})
  Object.keys(dependencies).forEach(name => {
    const tdepSemver = dependencies[name]
    let tdep = allDeps.get(`${name}@${tdepSemver}`)
    if (!tdep) {
      const tdepNode = yarnLock[`${name}@${tdepSemver}`]
      tdepNode.optional = lockNode.optionalDependencies ? lockNode.optionalDependencies[name] : false
      tdep = {node: makeNode(name, name, tdepNode), semverString: tdepSemver}
      addChild(tdep, dep, allDeps, yarnLock)
    } else {
      node.addDep(tdep.node)
    }
  })
}
