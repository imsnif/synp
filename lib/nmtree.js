'use strict'

const fs = require('fs')
const path = require('path')

function mergeScopes (basePath, packages, dir) {
  if (/^@/.test(dir)) {
    const scopedSuffixPackages = fs
      .readdirSync(path.join(basePath, dir))
      .filter(packageName => !/^\./.test(packageName))
    return packages.concat(scopedSuffixPackages.map(p => path.join(dir, p)))
  } else {
    return packages.concat(dir)
  }
}

module.exports = function nmTree (basePath, tree) {
  // TODO: error handling
  tree = tree || {}
  const packageJsonPath = path.join(basePath, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(path.join(basePath, 'package.json'), 'utf-8'))
    tree[basePath] = packageJson
    const nodeModulesPath = path.join(basePath, 'node_modules')
    if (fs.existsSync(nodeModulesPath)) { // TODO: and is dir
      const nodeModulesPackages = fs.readdirSync(nodeModulesPath)
      nodeModulesPackages
      .filter(dir => !/^\./.test(dir)) // no hidden directories (eg. .bin)
      .reduce((packages, dir) => mergeScopes(nodeModulesPath, packages, dir), [])
      .forEach(nmPackage => nmTree(path.join(nodeModulesPath, nmPackage), tree))
    }
  }
  return tree
}
