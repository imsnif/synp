'use strict'

const { join, sep } = require('path')
const lockfile = require('@yarnpkg/lockfile')
const eol = require('eol')
const { pick } = require('lodash')
const { nmtree } = require('../../util/nmtree')
const { buildNpmTree } = require('../lockfileV1/tree')
const { convertNpmV1ToYarn } = require('../lockfileV1')
const { read } = require('../../util/read')
const { getWorkspaces } = require('./workspace')
const sortObject = require('sort-object-keys')

module.exports = {
  convertYarnToNpmV2 (yarnLock, name, version, packageDir, packageJson) {
    const yarnLockNormalized = eol.lf(yarnLock)
    const yarnObject = lockfile.parse(yarnLockNormalized).object
    const nodeModulesTree = nmtree(packageDir)
    const workspacesTree = getWorkspaces(packageJson, packageDir).reduce((tree, pkgJsonPath) => {
      const pkgJson = read(pkgJsonPath)
      const pkgPath = pkgJsonPath.split(sep).slice(0, -1).join(sep) // trim "/package.json" ending

      tree[pkgJson.name] = {
        ...pkgJson,
        pkgPath
      }

      return tree
    }, {})
    const dependencies = sortObject(buildNpmTree(nodeModulesTree, yarnObject, workspacesTree))

    const flattenDeps = (_tree, prefix = '') => _tree
      ? Object.keys(_tree).reduce((tree, name) => {
          const entry = _tree[name]
          const isWorkspacePkg = /^file:/.test(entry.version)
          const _name = join(prefix, isWorkspacePkg ? entry.version.slice(5) : `node_modules${sep}${name}`)
          const pkgJsonPath = join(packageDir, _name, 'package.json')
          const pkgJson = read(pkgJsonPath)
          const requires = entry.requires
          const deps = (requires && Object.keys(requires).length > 0) ? requires : undefined
          const pkg = {
            [_name]: {
              version: isWorkspacePkg ? pkgJson.version : entry.version,
              resolved: isWorkspacePkg ? undefined : entry.resolved,
              integrity: entry.integrity,
              license: pkgJson.license,
              dependencies: deps,
              dev: entry.dev,
              engines: pkgJson.engines,
              bin: pkgJson.bin
            }
          }
          const link = isWorkspacePkg
            ? {
                [`node_modules${sep}${name}`]: {
                  resolved: _name,
                  link: true
                }
              }
            : undefined

          return {
            ...tree,
            ...flattenDeps(entry.dependencies, `${_name}${sep}`),
            ...pkg,
            ...link
          }
        }, {})
      : undefined

    const packages = sortObject({
      // append root package
      '': pick(packageJson,
        'name',
        'version',
        'license',
        'workspaces',
        'dependencies',
        'devDependencies',
        'optionalDependencies'
      ),
      ...flattenDeps(dependencies)
    })

    return JSON.stringify({
      name,
      version,
      lockfileVersion: 2,
      requires: true,
      packages,
      dependencies
    }, null, 2)
  },
  convertNpmV2ToYarn (packageLockFileString, packageDir) {
    return convertNpmV1ToYarn(packageLockFileString, packageDir)
  }
}
