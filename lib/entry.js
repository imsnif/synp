'use strict'

const { findPackageInYarnLock } = require('../util/traverse')
const { npmRequires } = require('./dependencies')
const { parse } = require('url')

const GITHUB_REGEX = /^\/([^/]+\/[^/]+)\/tar\.gz\/([0-9a-f]+)$/

function yarnToNpmResolved (version, yarnResolved) {
  const resolvedParts = parse(yarnResolved)
  if (resolvedParts.hostname === 'codeload.github.com') {
    const version = resolvedParts.pathname.replace(GITHUB_REGEX, 'github:$1#$2')
    return { version }
  }
  const resolved = yarnResolved.replace(/#.*$/, '')
  const hexChecksum = yarnResolved.replace(/^.*#/, '')
  const integrity = 'sha1-' + Buffer.from(hexChecksum, 'hex').toString('base64')
  return { version, resolved, integrity }
}

module.exports = {
  npmEntry (nodeModulesTree, yarnObject, mPath) {
    const { name, version, dependencies } = nodeModulesTree[mPath]
    const entryInYarnFile = findPackageInYarnLock(name, version, yarnObject)
    if (!entryInYarnFile) return null // likely a bundled dependency
    const yarnResolved = entryInYarnFile.resolved
    const entry = yarnToNpmResolved(version, yarnResolved)
    if (dependencies && Object.keys(dependencies).length > 0) {
      entry.requires = npmRequires(dependencies, yarnObject)
    }
    return entry
  }
}
