'use strict'

const test = require('tape')
const fs = require('fs')
const lockfile = require('@yarnpkg/lockfile')
const { yarnToNpm, npmToYarn } = require('../')
const eol = require('eol')
const { npmLogicalTree, yarnLogicalTree } = require('./utils/logical-tree')

const { stubs } = require('./fixtures/manifest-cache')
stubs()

function createYarnLogicalTree (yarnLockObject, packageJson) {
  const tree = yarnLogicalTree(packageJson, yarnLockObject)
  let flattened = {}
  tree.forEach((node, cb) => {
    const version = /^git+/.test(node.resolved) ? node.resolved : node.version // account for differences in how npm/yarn store github deps
    flattened[`${node.name}@${version}`] = {
      name: node.name,
      version,
      dependencies: Array.from(node.dependencies.entries()).reduce((dependencies, [name, value]) => {
        const version = /^git+/.test(value.resolved) ? value.resolved : value.version
        dependencies[name] = version
        return dependencies
      }, {})
    }
    cb()
  })
  return flattened
}

function createNpmLogicalTree (packageLock, packageJson) {
  const tree = npmLogicalTree(packageJson, packageLock)
  let flattened = {}
  tree.forEach((node, cb) => {
    flattened[`${node.name}@${node.version}`] = {
      name: node.name,
      version: node.version,
      dependencies: Array.from(node.dependencies.entries()).reduce((dependencies, [name, value]) => {
        dependencies[name] = value.version
        return dependencies
      }, {})
    }
    cb()
  })
  return flattened
}

test('translate with one root dependency', async t => {
  t.plan(2)
  try {
    const path = `${__dirname}/fixtures/single-root-dep`
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    t.deepEquals(
      JSON.parse(await yarnToNpm(path)),
      JSON.parse(packageLock),
      'can convert yarn to npm'
    )
    t.deepEquals(
      lockfile.parse(await npmToYarn(path)),
      lockfile.parse(yarnLock),
      'can convert npm to yarn'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate package-lock to yarn.lock with multiple-level dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/multiple-level-deps`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await npmToYarn(path)
    const resParsed = lockfile.parse(res).object
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const packageLockParsed = JSON.parse(packageLock)
    const resultLogicalTree = createYarnLogicalTree(resParsed, packageJson)
    const packageLockLogicalTree = createNpmLogicalTree(packageLockParsed, packageJson)
    t.deepEquals(packageLockLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with multiple-level dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/multiple-level-deps`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await yarnToNpm(path)
    const resParsed = JSON.parse(res)
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const yarnLockParsed = lockfile.parse(yarnLock)
    const yarnLogicalTree = createYarnLogicalTree(yarnLockParsed.object, packageJson)
    const resultLogicalTree = createNpmLogicalTree(resParsed, packageJson)
    t.deepEquals(yarnLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate package-lock to yarn.lock with multiple root dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/multiple-root-deps`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await npmToYarn(path)
    const resParsed = lockfile.parse(res).object
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const packageLockParsed = JSON.parse(packageLock)
    const resultLogicalTree = createYarnLogicalTree(resParsed, packageJson)
    const packageLockLogicalTree = createNpmLogicalTree(packageLockParsed, packageJson)
    t.deepEquals(packageLockLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with multiple root dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/multiple-root-deps`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await yarnToNpm(path)
    const resParsed = JSON.parse(res)
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const yarnLockParsed = lockfile.parse(yarnLock)
    const yarnLogicalTree = createYarnLogicalTree(yarnLockParsed.object, packageJson)
    const resultLogicalTree = createNpmLogicalTree(resParsed, packageJson)
    t.deepEquals(yarnLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate package-lock to yarn.lock with root devDependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/multiple-root-devdeps`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await npmToYarn(path)
    const resParsed = lockfile.parse(res).object
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const packageLockParsed = JSON.parse(packageLock)
    const resultLogicalTree = createYarnLogicalTree(resParsed, packageJson)
    const packageLockLogicalTree = createNpmLogicalTree(packageLockParsed, packageJson)
    t.deepEquals(packageLockLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with root devDependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/multiple-root-devdeps`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await yarnToNpm(path)
    const resParsed = JSON.parse(res)
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const yarnLockParsed = lockfile.parse(yarnLock)
    const yarnLogicalTree = createYarnLogicalTree(yarnLockParsed.object, packageJson)
    const resultLogicalTree = createNpmLogicalTree(resParsed, packageJson)
    t.deepEquals(yarnLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate package-lock to yarn.lock with root optionalDependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/multiple-root-optionaldeps`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await npmToYarn(path)
    const resParsed = lockfile.parse(res).object
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const packageLockParsed = JSON.parse(packageLock)
    const resultLogicalTree = createYarnLogicalTree(resParsed, packageJson)
    const packageLockLogicalTree = createNpmLogicalTree(packageLockParsed, packageJson)
    t.deepEquals(packageLockLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with root optionalDependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/multiple-root-optionaldeps`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await yarnToNpm(path)
    const resParsed = JSON.parse(res)
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const yarnLockParsed = lockfile.parse(yarnLock)
    const yarnLogicalTree = createYarnLogicalTree(yarnLockParsed.object, packageJson)
    const resultLogicalTree = createNpmLogicalTree(resParsed, packageJson)
    t.deepEquals(yarnLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate package-lock to yarn.lock with root dependencies, devDependencies and optionalDependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/multiple-root-alldeps`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await npmToYarn(path)
    const resParsed = lockfile.parse(res).object
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const packageLockParsed = JSON.parse(packageLock)
    const resultLogicalTree = createYarnLogicalTree(resParsed, packageJson)
    const packageLockLogicalTree = createNpmLogicalTree(packageLockParsed, packageJson)
    t.deepEquals(packageLockLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with root dependencies, devDependencies and optionalDependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/multiple-root-alldeps`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await yarnToNpm(path)
    const resParsed = JSON.parse(res)
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const yarnLockParsed = lockfile.parse(yarnLock)
    const yarnLogicalTree = createYarnLogicalTree(yarnLockParsed.object, packageJson)
    const resultLogicalTree = createNpmLogicalTree(resParsed, packageJson)
    t.deepEquals(yarnLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate package-lock to yarn.lock with scopes', async t => { // TODO: FIX THIS TEST! issue with bundled deps
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/deps-with-scopes`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await npmToYarn(path)
    const resParsed = lockfile.parse(res).object
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const packageLockParsed = JSON.parse(packageLock)
    const resultLogicalTree = createYarnLogicalTree(resParsed, packageJson)
    const packageLockLogicalTree = createNpmLogicalTree(packageLockParsed, packageJson)
    t.deepEquals(packageLockLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with scopes', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/deps-with-scopes`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await yarnToNpm(path)
    const resParsed = JSON.parse(res)
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const yarnLockParsed = lockfile.parse(yarnLock)
    const yarnLogicalTree = createYarnLogicalTree(yarnLockParsed.object, packageJson)
    const resultLogicalTree = createNpmLogicalTree(resParsed, packageJson)
    t.deepEquals(yarnLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate package-lock to yarn.lock with bundled dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/bundled-deps-npm`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await npmToYarn(path)
    const resParsed = lockfile.parse(res).object
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const packageLockParsed = JSON.parse(packageLock)
    const resultLogicalTree = createYarnLogicalTree(resParsed, packageJson)
    const packageLockLogicalTree = createNpmLogicalTree(packageLockParsed, packageJson)
    t.deepEquals(packageLockLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with bundled dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/bundled-deps-yarn`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await yarnToNpm(path)
    const resParsed = JSON.parse(res)
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const yarnLockParsed = lockfile.parse(yarnLock)
    const yarnLogicalTree = createYarnLogicalTree(yarnLockParsed.object, packageJson)
    const resultLogicalTree = createNpmLogicalTree(resParsed, packageJson)
    t.deepEquals(yarnLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with github dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/github-dep-yarn`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await yarnToNpm(path)
    const resParsed = JSON.parse(res)
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const yarnLockParsed = lockfile.parse(yarnLock)
    const yarnLogicalTree = createYarnLogicalTree(yarnLockParsed.object, packageJson)
    const resultLogicalTree = createNpmLogicalTree(resParsed, packageJson)
    t.deepEquals(yarnLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate package-lock to yarn.lock with github dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/github-deps`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await npmToYarn(path)
    const resParsed = lockfile.parse(res).object
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const packageLockParsed = JSON.parse(packageLock)
    const resultLogicalTree = createYarnLogicalTree(resParsed, packageJson)
    const packageLockLogicalTree = createNpmLogicalTree(packageLockParsed, packageJson)
    t.deepEquals(packageLockLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with crlf line ending', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/yarn-crlf`
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await yarnToNpm(path)
    const resParsed = JSON.parse(res)
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const yarnLockNormalized = eol.lf(yarnLock)
    const yarnLockParsed = lockfile.parse(yarnLockNormalized)
    const yarnLogicalTree = createYarnLogicalTree(yarnLockParsed.object, packageJson)
    const resultLogicalTree = createNpmLogicalTree(resParsed, packageJson)
    t.deepEquals(yarnLogicalTree, resultLogicalTree, 'result logically identical to original')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('error => corrupted package-lock to yarn.lock', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/single-dep-corrupted-version`
    try {
      await npmToYarn(path)
      t.fail('did not throw')
    } catch (e) {
      t.equals(
        e.message,
        '404 Not Found: fake-dep@https://registry.npmjs.org/fake-dep/-/fake-dep-2.1.14.tgz',
        'proper error message'
      )
    }
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('error => no source file', async t => {
  t.plan(2)
  try {
    const path = `${__dirname}/fixtures/foo`
    try {
      await npmToYarn(path)
      t.fail('did not throw error when converting to yarn')
    } catch (e) {
      t.ok(
        e.message.includes('no such file or directory'),
        'proper error thrown when converting to yarn'
      )
    }
    try {
      await yarnToNpm(path)
      t.fail('did not throw error when converting to npm')
    } catch (e) {
      t.ok(
        e.message.includes('no such file or directory'),
        'proper error thrown when converting to npm'
      )
    }
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('error => no package.json', async t => {
  t.plan(2)
  try {
    const path = `${__dirname}/fixtures/no-package-json`
    try {
      await npmToYarn(path)
      t.fail('did not throw error when converting to yarn')
    } catch (e) {
      t.ok(
        e.message.includes('no such file or directory'),
        'proper error thrown from npmToYarn for non-existent path'
      )
    }
    try {
      await npmToYarn(path)
      t.fail('did not throw error when converting to yarn')
    } catch (e) {
      t.ok(
        e.message.includes('no such file or directory'),
        'proper error thrown from yarnToNpm for non-existent path'
      )
    }
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})
