'use strict'

const test = require('tape')
const fs = require('fs')
const lockfile = require('@yarnpkg/lockfile')
const { yarnToNpm, npmToYarn } = require('../')
const logicalTree = require('npm-logical-tree')

const md5 = require('md5')

const { npmLogicalTree, yarnLogicalTree } = require('./utils/logical-tree')

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
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const yarnFile = await npmToYarn(path)
    const res = lockfile.parse(
      yarnFile.replace(/registry.yarnpkg.com/g, 'registry.npmjs.org')
    )
    const yarnLockWithNpmRegistry = yarnLock.replace(
      /registry.yarnpkg.com/g,
      'registry.npmjs.org'
    )
    const yarnLockObject = lockfile.parse(yarnLockWithNpmRegistry)
    t.deepEquals(
      res,
      yarnLockObject,
      'result is equal to yarn.lock file'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with multiple-level dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/multiple-level-deps`
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const res = await yarnToNpm(path)
    const resReplaced = res.replace(
      /registry.yarnpkg.com/g,
      'registry.npmjs.org'
    )
    const resParsed = JSON.parse(resReplaced)
    const packageLockParsed = JSON.parse(packageLock)
    t.deepEquals(
      resParsed,
      packageLockParsed,
      'result is equal to yarn.lock file'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate package-lock to yarn.lock with scopes', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/deps-with-scopes`
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const convertedYarnLock = await npmToYarn(path)
    const res = lockfile.parse(convertedYarnLock.replace(
      /registry.yarnpkg.com/g,
      'registry.npmjs.org'
    ))
    const yarnLockWithNpmRegistry = yarnLock.replace(
      /registry.yarnpkg.com/g,
      'registry.npmjs.org'
    )
    const yarnLockObject = lockfile.parse(yarnLockWithNpmRegistry)
    t.deepEquals(
      res,
      yarnLockObject,
      'result is equal to yarn.lock file'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

function createYarnLogicalTree (yarnLockObject, packageJson) {
  const tree = yarnLogicalTree(packageJson, yarnLockObject)
  let flattened = {}
  tree.forEach((node, cb) => {
    // if (flattened[`${node.name}@${node.version}`] && node.optional) return
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

test.only('translate yarn.lock to package-lock with scopes', async t => {
  try {
    // t.plan(1)
    // const path = `${__dirname}/fixtures/deps-with-scopes`
    const path = `${__dirname}/fixtures/test-deps-with-scopes`
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const packageJson = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf-8'))
    const res = await yarnToNpm(path)
    // console.log('res:', res)
    const resReplaced = res.replace(
      /registry.yarnpkg.com/g,
      'registry.npmjs.org'
    )
    const resParsed = JSON.parse(resReplaced)
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8').replace(/registry.yarnpkg.com/g, 'registry.npmjs.org')
    const yarnLockParsed = lockfile.parse(yarnLock)
    const packageLockParsed = JSON.parse(packageLock)
    const packageLockLogicalTree = createNpmLogicalTree(packageLockParsed, packageJson)
    const yarnLogicalTree = createYarnLogicalTree(yarnLockParsed.object, packageJson)
    const resultLogicalTree = createNpmLogicalTree(resParsed, packageJson)
    t.deepEquals(yarnLogicalTree, resultLogicalTree, 'result logically identical')
    t.end()
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate package-lock to yarn.lock with bundled dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/bundled-deps-npm`
    const yarnLock = fs.readFileSync(`${path}/.yarn-lock-snapshot`, 'utf-8')
    const res = await npmToYarn(path)
    t.deepEquals(
      lockfile.parse(res),
      lockfile.parse(yarnLock),
      'result is equal to yarn.lock snapshot (bundled dependencies ignored)'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with bundled dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/bundled-deps-yarn`
    const packageLock = fs.readFileSync(
      `${path}/.package-lock-snapshot.json`,
      'utf-8'
    )
    const res = yarnToNpm(path)
    t.deepEquals(
      JSON.parse(res),
      JSON.parse(packageLock),
      'result is equal to yarn.lock snapshot'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with github dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/github-dep-yarn`
    const packageLock = fs.readFileSync(`${path}/.package-lock-snapshot.json`, 'utf-8')
    const res = yarnToNpm(path)
    t.deepEquals(
      JSON.parse(res),
      JSON.parse(packageLock),
      'result is equal to package-lock.json snapshot'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate package-lock to yarn.lock with github dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/github-deps`
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const yarnFile = await npmToYarn(path)
    const res = lockfile.parse(
      yarnFile.replace(/registry.yarnpkg.com/g, 'registry.npmjs.org')
    )
    const yarnLockWithNpmRegistry = yarnLock.replace(
      /registry.yarnpkg.com/g,
      'registry.npmjs.org'
    )
    const yarnLockObject = lockfile.parse(yarnLockWithNpmRegistry)
    t.deepEquals(
      res,
      yarnLockObject,
      'result is equal to yarn.lock file'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with crlf line ending', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/yarn-crlf`
    const packageLock = fs.readFileSync(`${path}/.package-lock-snapshot.json`, 'utf-8')
    const res = yarnToNpm(path)
    t.deepEquals(
      JSON.parse(res),
      JSON.parse(packageLock),
      'result is equal to package-lock.json snapshot'
    )
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
