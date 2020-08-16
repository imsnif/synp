'use strict'

const lockfile = require('@yarnpkg/lockfile')
const eol = require('eol')
const nmtree = require('nmtree')
const { pick } = require('lodash')
const { buildNpmTree } = require('../lockfileV1/tree')
const { convertNpmV1ToYarn } = require('../lockfileV1')
const { readJson } = require('../../util/read')
const sortObject = require('sort-object-keys')

module.exports = {
  convertYarnToNpmV2 (yarnLock, name, version, packageDir, packageJson) {
    const yarnLockNormalized = eol.lf(yarnLock)
    const yarnObject = lockfile.parse(yarnLockNormalized).object
    const nodeModulesTree = nmtree(packageDir)
    const dependencies = sortObject(buildNpmTree(nodeModulesTree, yarnObject, true))

    const flattenDeps = (_tree, prefix = '') => _tree
      ? Object.keys(_tree).reduce((tree, name) => {
        const entry = _tree[name]
        const isWorkspacePkg = /^file:package/.test(entry.version)
        const _name = prefix + (isWorkspacePkg ? 'packages' : 'node_modules') + '/' + name
        const pkgJson = readJson(packageDir + '/' + _name + '/package.json')
        const pkg = {
          [_name]: {
            version: isWorkspacePkg ? pkgJson.version : entry.version,
            resolved: isWorkspacePkg ? undefined : entry.resolved,
            integrity: entry.integrity,
            license: pkgJson.license,
            dependencies: entry.requires || undefined
          }
        }
        const link = isWorkspacePkg
          ? {
            ['node_modules/' + name]: {
              resolved: _name,
              link: true
            }
          }
          : undefined

        return {
          ...tree,
          ...flattenDeps(entry.dependencies, `${_name}/`),
          ...pkg,
          ...link
        }
      }, {})
      : undefined

    const packages = sortObject({
      // append root package
      '': pick(packageJson, 'name', 'version', 'license', 'workspaces', 'dependencies'),
      ...flattenDeps(dependencies)
    })

    return JSON.stringify({
      name,
      version,
      lockfileVersion: 2,
      requires: true,
      packages,
      dependencies
    })
  },
  convertNpmV2ToYarn (packageLockFileString, packageDir) {
    return convertNpmV1ToYarn(packageLockFileString, packageDir)
  }
}
