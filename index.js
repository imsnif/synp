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

async function mixSemversIn (nodeModulesTree, packageJson, getRemoteManifest, bar) {
  await nodeModulesTree.forEachAsync(async (node, cb) => {
    const manifest = await getManifest(node, packageJson, getRemoteManifest)
    node.dependencies = updateDependenciesWithSemver(node, manifest, packageJson)
    node.version = normalizeVersion(node, manifest)
    node.resolved = await normalizeResolved(node, manifest)
    bar.increment()
    await cb()
  })
}

function formatYarnDependencies (dependencies) {
  return Array.from(dependencies.entries())
  .reduce(({ yarnDeps, yarnOptionalDeps }, [ nameAndSemver, depVal ]) => {
    const name = nameAndSemver.replace(/@[^@]*$/g, '')
    const semverString = nameAndSemver.replace(/^.*@/g, '')
    if (depVal.optional) {
      yarnOptionalDeps[name] = semverString
    } else {
      yarnDeps[name] = semverString
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
    const bar = createProgressBar(nodeModulesTree)
    const getRemoteManifest = remoteManifestQueue()
    try {
      let yarnTree = {}
      // [ nodeName ]: { .. } ===> [ nodeName@semverString ]: { .. }
      // node.version = [ semverString ] || [ packageUrl ] // TODO: ??
      // node.resolved = [ url#hash ]
      await mixSemversIn(nodeModulesTree, packageJson, getRemoteManifest, bar)
      nodeModulesTree.forEach((node, cb) => {
        const { dependencies } = node
        dependencies.forEach((dep, depName) => {
          const { version, resolved, dependencies } = dep
          const { yarnDeps, yarnOptionalDeps } = formatYarnDependencies(dependencies)
          const depsForEntry = Object.keys(yarnDeps).length > 0 ? yarnDeps : null
          const optDepsForEntry = Object.keys(yarnOptionalDeps).length > 0 ? yarnOptionalDeps : null
          yarnTree[depName] = {
            version, resolved,
            dependencies: depsForEntry,
            optionalDependencies: optDepsForEntry
          }
        })
        cb()
      })
      bar.stop()
      return lockfile.stringify(yarnTree)
    } catch (e) {
      bar.stop()
      throw e
    }
  }
}
