'use strict'

const fs = require('fs')
const path = require('path')
const lockfile = require('@yarnpkg/lockfile')
const eol = require('eol')
const logicalTree = require('npm-logical-tree')

const cliProgress = require('cli-progress')

const jsonStringify = require('json-stable-stringify')

const { yarnTree } = require('./lib/yarn-tree')
const { createTreeManifest } = require('./lib/tree-manifest')

const { createLogicalTree, createLogicalTreeNpm } = require('./lib/logical-tree')
const { createPhysicalTree } = require('./lib/physical-tree')
const { packageLockTree } = require('./lib/package-lock-tree')

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
      const flatTree = await createTreeManifest({manifest: packageJson, yarnObject}) // TODO: name
      const logicalTree = createLogicalTree({packageJson, flatTree, yarnObject})
      const physicalTree = createPhysicalTree({logicalTree})
      const packageLock = packageLockTree({physicalTree})
      const { name, version } = packageJson
      return jsonStringify(Object.assign({}, packageLock.toObject(), {
        name,
        version,
        lockfileVersion: 1,
        requires: true
      }), {
        space: 2,
        cmp: (a, b) => {
          const aPriority = priorityOf(a.key)
          const bPriority = priorityOf(b.key)
          if (aPriority && bPriority) {
            return aPriority < bPriority ? -1 : 1
          } else {
            return a.key < b.key ? -1 : 1
          }
        }
      })
    } catch (e) {
      throw e
    }
  },
  async npmToYarn (packageDir) {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8')
    )
    const packageLock = JSON.parse(
      fs.readFileSync(
        path.join(packageDir, 'package-lock.json'),
        'utf-8'
      )
    )
    // const bar = createProgressBar(nodeModulesTree)
    try {
      const logicalTree = await createLogicalTreeNpm({packageJson, packageLock})
      const yarnLock = await yarnTree({logicalTree})
      const yarnObj = yarnLock.toObject()
      // bar.stop()
      return lockfile.stringify(yarnObj)
    } catch (e) {
      // bar.stop()
      throw e
    }
  }
}
