'use strict'

const fs = require('fs')
const path = require('path')
const lockfile = require('@yarnpkg/lockfile')
const eol = require('eol')
const nmtree = require('nmtree')
const logicalTree = require('npm-logical-tree')
const { buildNpmTree } = require('./lib/tree')

const cliProgress = require('cli-progress')

const { yarnTree } = require('./lib/yarn-tree')

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

module.exports = {
  yarnToNpm (packageDir) {
    const yarnLock = fs.readFileSync(
      path.join(packageDir, 'yarn.lock'),
      'utf-8'
    )
    const yarnLockNormalized = eol.lf(yarnLock)
    const yarnObject = lockfile.parse(yarnLockNormalized).object
    const nodeModulesTree = nmtree(packageDir)
    const dependencies = buildNpmTree(nodeModulesTree, yarnObject)
    const packageJson = fs.readFileSync(path.join(packageDir, 'package.json'))
    const { name, version } = JSON.parse(packageJson)
    return JSON.stringify({
      name,
      version,
      lockfileVersion: 1,
      requires: true,
      dependencies
    })
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
