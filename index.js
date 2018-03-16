'use strict'

const semver = require('semver')
const fs = require('fs')
const rp = require('request-promise')
const ssri = require('ssri')
const path = require('path')
const lockfile = require('@yarnpkg/lockfile')
const eol = require('eol')
const nmtree = require('nmtree')
const logicalTree = require('npm-logical-tree')
const { buildNpmTree } = require('./lib/tree')
const querystring = require('querystring')

const cliProgress = require('cli-progress')

const md5 = require('md5')

const limit = require('call-limit')
const pacote = require('pacote')

const util = require('util')
const Queue = require('promise-queue')

const { npmToYarnResolved } = require('./lib/entry')

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

function remoteManifestQueue () {
  const queue = new Queue(10, Infinity)
  return pkg => queue.add(() => pacote.manifest(pkg))
}

function getManifest (node, packageJson, getRemoteManifest) {
  const { name, version } = node
  if (node.isRoot) return Promise.resolve(packageJson)
  return getRemoteManifest(`${name}@${version}`)
}

function updateDependenciesWithSemver (node, manifest, packageJson) {
  const dependencies = Array.from(node.dependencies.entries())
  return dependencies.reduce((updated, [depName, depVal]) => {
    const depType = depVal.dev
      ? 'devDependencies'
      : depVal.optional
      ? 'optionalDependencies'
      : 'dependencies'
    const semverStringCandidate = node.isRoot ? packageJson.dependencies[depName] : manifest[depType][depName]
    const semverString = semverStringCandidate || manifest.dependencies[depName] // TODO: find a better way
    updated.set(`${depName}@${semverString}`, depVal)
    return updated
  }, new Map())
}

function normalizeVersion (node, manifest) {
  return (
    semver.valid(node.version)
      ? node.version
      : manifest.version // eg. git dependency
  )
}

async function getResolved (node, manifest) {
  const { resolved, bundled } = node
  const resolvedInManifest = manifest.resolved || manifest._resolved
  if (!resolved && !bundled && resolvedInManifest) {
    const resolved = manifest.resolved || manifest._resolved
    const file = await rp({
      url: resolved,
      encoding: null
    })
    const integrity = ssri.create({algorithms: ['sha1']}).update(file)
    const digest = integrity.digest()
    const hexDigest = digest.hexDigest()
    return `${resolved}#${hexDigest}`
  } else {
    return Promise.resolve(resolved)
  }
}

async function normalizeResolved(node, manifest) {
  const { integrity } = node
  const resolvedInManifest = manifest.resolved || manifest._resolved
  const resolved = await getResolved(node, manifest)
  return (
    resolved
      ? npmToYarnResolved(resolved, integrity)
      : null
  )
}

async function mixSemversIn (nodeModulesTree, packageJson, getRemoteManifest, bar, yarnTree) {
  await nodeModulesTree.forEachAsync(async (node, cb) => {
    await yarnTree.addEntry(node)
    bar.increment()
    await cb()
  })
}

function yarnEntry () {
  let semvers = []
  let node = {}
  let state = {}
  let name = null
  function _isPopulated (key) {
    return state[key] && Object.keys(state[key]).length > 0
  }
  return Object.freeze({
    set node (val) {
      node = val
    },
    get node () {
      return (node && Object.keys(node) > 0 ? node : null)
    },
    set name (val) {
      name = val
    },
    get name () {
      return name
    },
    get version () {
      return state.version
    },
    set version (val) {
      state.version = val
    },
    set dependencies (val) {
      const { yarnDeps, yarnOptionalDeps } = formatYarnDependencies(val, node.dependencies)
      state.dependencies = yarnDeps
      state.optionalDependencies = yarnOptionalDeps
    },
    get dependencies () {
      return state.dependencies
    },
    get resolved () {
      return state.resolved
    },
    set resolved (val) {
      state.resolved = val
    },
    get semvers () {
      return semvers
    },
    toObject () {
      return Object.assign({}, state, {
        dependencies: _isPopulated('dependencies')
          ? state.dependencies
          : null,
        optionalDependencies: _isPopulated('optionalDependencies')
          ? state.optionalDependencies
          : null
      })
    }
  })
}

function yarnTree (nodeModulesTree, packageJson, getRemoteManifest) {
  let entries = new Map()
  return Object.freeze({
    async addEntry (node) {
      const manifest = await getManifest(node, packageJson, getRemoteManifest)
      Object.keys(manifest.dependencies).forEach(depName => {
        if (!node.dependencies.get(depName)) return
        // eg. fsevents TODO: fix for platform specific dependencies
        const key = md5(depName + node.dependencies.get(depName).version)
        const semverString = manifest.dependencies[depName]
        const entry = entries.get(key) || yarnEntry()
        entry.semvers.push(semverString)
        entries.set(key, entry)
      })
      if (!node.address) return // root node
      const key = md5(node.name + node.version)
      const entry = entries.get(key) || yarnEntry()
      entry.node = entry.node || node
      entries.set(key, entry)
      entry.name = node.name
      entry.version = normalizeVersion(node, manifest)
      entry.dependencies = manifest.dependencies
      entry.resolved = await normalizeResolved(node, manifest)
    },
    entries () {
      return entries
    },
    toObject () {
      return Array.from(entries.entries()).reduce((obj, [key, val]) => {
        const name = val.name
        const semverStrings = val.semvers
        semverStrings.forEach(s => {
          obj[`${name}@${s}`] = val.toObject()
        })
        return obj
      }, {})
    }
  })
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

function formatYarnDependencies (manifestDependencies, nodeDependencies) {
  return Object.keys(manifestDependencies)
  .reduce(({yarnDeps, yarnOptionalDeps}, depName) => {
    const depLogicalEntry = nodeDependencies.get(depName)
    const depSemver = manifestDependencies[depName]
    if (!depLogicalEntry) return {yarnDeps, yarnOptionalDeps}
    // eg. fsevents TODO: fix for platform specific dependencies
    if (depLogicalEntry.optional === true) {
      yarnOptionalDeps[depName] = depSemver
    } else {
      yarnDeps[depName] = depSemver
    }
    return {yarnDeps, yarnOptionalDeps}
  }, {yarnDeps: {}, yarnOptionalDeps: {}})
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
    const getRemoteManifest = remoteManifestQueue()
    try {
      let tree = yarnTree(nodeModulesTree, packageJson, getRemoteManifest)
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
