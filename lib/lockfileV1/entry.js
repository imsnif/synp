'use strict'

const url = require('url')
const sortObject = require('sort-object-keys')
const { findPackageInYarnLock, findEntryInPackageLock } = require('../../util/traverse')
const { formatNpmIntegrity, formatYarnIntegrity, parseIntegrity, sha1ToHexChecksum, hexChecksumToSha1 } = require('./integrity')
const { npmRequires } = require('./dependencies')

const parse = (input) => url.parse ? url.parse(input) : new url.URL(input) // eslint-disable-line
const GITHUB_REGEX = /^\/([^/]+\/[^/]+)\/tar\.gz\/([0-9a-f]+)$/

function yarnToNpmResolved (version, yarnResolved, request, integrityField) {
  // Handle file dependency (there is no URL to parse).
  if (yarnResolved === undefined) {
    return { version: request }
  }

  const resolvedParts = parse(yarnResolved)

  if (resolvedParts.hostname === 'codeload.github.com') {
    const version = resolvedParts.pathname.replace(GITHUB_REGEX, 'github:$1#$2')
    return { version }
  }

  const isTarball = /^https?:\/\//.test(request)
  const resolved = yarnResolved.replace(/#.*$/, '')
  const hexChecksum = yarnResolved.replace(/^.*#/, '')
  const integrity = formatNpmIntegrity(hexChecksumToSha1(hexChecksum), integrityField)

  if (isTarball) {
    return {
      integrity,
      version: request
    }
  }

  const isGit = /^git\+/.test(request)

  if (isGit) {
    return {
      version: yarnResolved,
      from: request
    }
  }

  return { version, resolved, integrity }
}

function npmToYarnResolved (resolved, integrity) {
  let result = resolved

  if (integrity) {
    const hexChecksum = sha1ToHexChecksum(integrity)
    // see caveats in README
    result = `${result}#${hexChecksum}`
  }

  const resolvedParts = parse(result)

  if (resolvedParts.protocol === 'file:') {
    result = undefined
  } else if (resolvedParts.protocol === 'github:') {
    result = result.replace(/^github:/, 'https://github.com/')
  }

  return result
}

const npmEntry = (nodeModulesTree, yarnObject, mPath) => {
  const { name, version, dependencies } = nodeModulesTree[mPath]
  const { request, entry: entryInYarnFile } = findPackageInYarnLock(name, version, yarnObject)

  if (!entryInYarnFile) return null // likely a bundled dependency

  const yarnResolved = entryInYarnFile.resolved
  const entry = yarnToNpmResolved(version, yarnResolved, request, entryInYarnFile.integrity)

  if (dependencies && Object.keys(dependencies).length > 0) {
    entry.requires = sortObject(npmRequires(dependencies, yarnObject, nodeModulesTree))

    const resolvedDeps = Object.keys(dependencies).reduce((m, name) => {
      const childPath = `${mPath}/node_modules/${name}`

      if (nodeModulesTree[childPath]) {
        const childEntry = npmEntry(nodeModulesTree, yarnObject, childPath)

        if (childEntry) {
          m[name] = {
            version: childEntry.version,
            resolved: childEntry.resolved,
            integrity: childEntry.integrity,
            requires: childEntry.requires
          }
        }
      }

      return m
    }, {})

    if (Object.keys(resolvedDeps).length) {
      entry.dependencies = sortObject(resolvedDeps)
    }
  }

  return entry
}
const yarnEntry = (entry, allDeps, flattenedPackageLock, tree) => {
  const { name, version } = entry
  const entryInNpmFile = findEntryInPackageLock(entry, flattenedPackageLock)
  if (!entryInNpmFile) return null // likely a bundled dependency
  const {
    resolved,
    integrity
  } = entryInNpmFile
  const integrityChunks = parseIntegrity(integrity)
  const yarnStyleResolved = npmToYarnResolved(resolved || version, integrityChunks.sha1)
  const existingPackage = tree[name] || {}
  const existingPackageVersion = tree[name] && tree[name][version]
    ? tree[name][version]
    : {}
  const { dependencies, optionalDependencies } = allDeps
  const hasDeps = dependencies && Object.keys(dependencies).length > 0
  const hasOptionalDeps = optionalDependencies &&
    Object.keys(optionalDependencies).length > 0

  return Object.assign({}, existingPackage, {
    [version]: Object.assign({}, existingPackageVersion, {
      resolved: yarnStyleResolved,
      integrity: formatYarnIntegrity(integrityChunks.sha512 || integrityChunks.sha1)
    },
    hasDeps ? { dependencies } : {},
    hasOptionalDeps ? { optionalDependencies } : {}
    )
  })
}

module.exports = {
  npmEntry,
  yarnEntry
}
