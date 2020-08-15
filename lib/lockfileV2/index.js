'use strict'

const {sep} = require('path')
const lockfile = require('@yarnpkg/lockfile')
const eol = require('eol')
const nmtree = require('nmtree')
const {pick} = require('lodash')
const {getWorkspaces} = require('./workspace')
// const {npmEntry} = require('../lockfileV1/entry')
const {buildNpmTree} = require('../lockfileV1/tree')
const {readJson} = require('../../util/read')
// const {splitPathToModules} = require('../../util/traverse')
const sortObject = require('sort-object-keys')

module.exports = {
  convertYarnToNpmV2(yarnLock, name, version, packageDir, packageJson) {
    const yarnLockNormalized = eol.lf(yarnLock)
    const yarnObject = lockfile.parse(yarnLockNormalized).object
    const nodeModulesTree = nmtree(packageDir)
    const workspacesTree = getWorkspaces(packageJson, packageDir).reduce((tree, path) => {
      const pkg = readJson(path)
      tree[pkg.name] = pkg
      return tree
    }, {})

    const dependencies = sortObject(buildNpmTree(nodeModulesTree, yarnObject, true))
    const flattenDeps = (_tree, prefix = '') => _tree
      ? Object.keys(_tree).reduce((tree, name) => {
        const entry = _tree[name]
        const isWorkspacePkg = !!(!prefix && workspacesTree[name])
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
      }, {
        // append root package
        "": pick(packageJson, 'name', 'version', 'license', 'workspaces', 'dependencies')
      })
      : undefined

    const packages = sortObject(flattenDeps(dependencies))


    //console.log('deps=', JSON.stringify(dependencies, null, 2))
    //console.log('packages=', JSON.stringify(packages, null, 2))


    // console.log('workspacesTree=', workspacesTree)
    // console.log('yarnObject=', yarnObject)
    // console.log('nmtree=', nodeModulesTree)

    return JSON.stringify({
      name,
      version,
      lockfileVersion: 2,
      requires: true,
      packages,
      dependencies
    })

    // throw new Error('yarn "workspaces" require npm lockfileVersion v2, but it is not supported yet')
  },
  convertNpmV2ToYarn(packageLockFileString, packageDir) {
    throw new Error('npm lockfileVersion v2 is not supported yet')
  },
}
