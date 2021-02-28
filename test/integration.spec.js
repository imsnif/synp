'use strict'

const test = require('tape')
const sinon = require('sinon')
const fs = require('fs')
const lockfile = require('@yarnpkg/lockfile')
const { yarnToNpm, npmToYarn } = require('../')
const fixtures = require('path').resolve(__dirname, 'fixtures')
const {
  findNonSha1Hashes,
  replaceNonSha1,
  normalizePackageLock
} = require('./test-utils')

test('translate with one root dependency', async t => {
  t.plan(2)
  try {
    const path = `${fixtures}/single-root-dep`
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    t.deepEquals(
      JSON.parse(yarnToNpm(path)),
      JSON.parse(packageLock),
      'can convert yarn to npm'
    )
    t.deepEquals(
      lockfile.parse(npmToYarn(path)),
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
    const path = `${fixtures}/multiple-level-deps`
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const res = lockfile.parse(
      npmToYarn(path).replace(/registry.yarnpkg.com/g, 'registry.npmjs.org')
    )
    const yarnLockWithNpmRegistry = yarnLock.replace(
      /registry.yarnpkg.com/g,
      'registry.npmjs.org'
    )
    const yarnLockObject = lockfile.parse(yarnLockWithNpmRegistry)
    const { dependencies } = JSON.parse(packageLock)
    const resolvedWithNonSha1Hashes = findNonSha1Hashes({ dependencies })
    const yarnLockObjReplaced = replaceNonSha1(
      yarnLockObject,
      resolvedWithNonSha1Hashes
    )
    const resReplaced = replaceNonSha1(res, resolvedWithNonSha1Hashes)
    t.deepEquals(
      resReplaced,
      yarnLockObjReplaced,
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
    const path = `${fixtures}/multiple-level-deps`
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const res = yarnToNpm(path).replace(
      /registry\.yarnpkg\.com/g,
      'registry.npmjs.org'
    )
    const resParsed = JSON.parse(res)
    const packageLockParsed = JSON.parse(packageLock)
    const resolvedWithNonSha1Hashes = findNonSha1Hashes(
      { dependencies: packageLockParsed.dependencies }
    )
    const resReplaced = normalizePackageLock(
      resParsed,
      resolvedWithNonSha1Hashes
    )
    const packageLockReplaced = normalizePackageLock(
      packageLockParsed,
      resolvedWithNonSha1Hashes
    )
    t.deepEquals(
      resReplaced,
      packageLockReplaced,
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
    const path = `${fixtures}/deps-with-scopes`
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const res = lockfile.parse(npmToYarn(path).replace(
      /registry.yarnpkg.com/g,
      'registry.npmjs.org'
    ))
    const yarnLockWithNpmRegistry = yarnLock.replace(
      /registry.yarnpkg.com/g,
      'registry.npmjs.org'
    )
    const yarnLockObject = lockfile.parse(yarnLockWithNpmRegistry)
    const { dependencies } = JSON.parse(packageLock)
    const resolvedWithNonSha1Hashes = findNonSha1Hashes({ dependencies })
    const yarnLockObjReplaced = replaceNonSha1(
      yarnLockObject,
      resolvedWithNonSha1Hashes
    )
    const resReplaced = replaceNonSha1(res, resolvedWithNonSha1Hashes)
    t.deepEquals(
      resReplaced.object,
      yarnLockObjReplaced.object,
      'result is equal to yarn.lock file'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with scopes', async t => {
  try {
    t.plan(1)
    const path = `${fixtures}/deps-with-scopes`
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const res = yarnToNpm(path).replace(
      /registry.yarnpkg.com/g,
      'registry.npmjs.org'
    )
    const resParsed = JSON.parse(res)
    const packageLockParsed = JSON.parse(packageLock)
    const resolvedWithNonSha1Hashes = findNonSha1Hashes(
      { dependencies: packageLockParsed.dependencies }
    )
    const resReplaced = normalizePackageLock(resParsed, resolvedWithNonSha1Hashes)
    const packageLockReplaced = normalizePackageLock(
      packageLockParsed,
      resolvedWithNonSha1Hashes
    )
    t.deepEquals(
      resReplaced,
      packageLockReplaced,
      'result is equal to package-lock.json file'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate package-lock to yarn.lock with bundled dependencies', async t => {
  try {
    t.plan(1)
    const path = `${fixtures}/bundled-deps-npm`
    const yarnLock = fs.readFileSync(`${path}/.yarn-lock-snapshot`, 'utf-8')
    const res = npmToYarn(path)
    t.deepEquals(
      lockfile.parse(res),
      lockfile.parse(yarnLock),
      'result is equal to yarn.lock snapshot'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with bundled dependencies', async t => {
  try {
    t.plan(1)
    const path = `${fixtures}/bundled-deps-yarn`
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
    const path = `${fixtures}/github-dep-yarn`
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

test('translate yarn.lock to package-lock with crlf line ending', async t => {
  try {
    t.plan(1)
    const path = `${fixtures}/yarn-crlf`
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

test('translate corrupted package-lock to yarn.lock', async t => {
  try {
    t.plan(1)
    const path = `${fixtures}/single-dep-corrupted-version`
    const yarnLock = fs.readFileSync(`${path}/.yarn-lock-snapshot`, 'utf-8')
    const res = npmToYarn(path)
    const resParsed = lockfile.parse(res)
    const yarnLockParsed = lockfile.parse(yarnLock)
    t.deepEquals(
      resParsed,
      yarnLockParsed,
      'result is equal to yarn.lock snapshot'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('error => no source file', async t => {
  t.plan(2)
  try {
    const path = `${fixtures}/foo`
    t.throws(
      () => npmToYarn(path),
      /no such file or directory/,
      'proper error thrown from npmToYarn for non-existent path'
    )
    t.throws(
      () => yarnToNpm(path),
      /no such file or directory/,
      'proper error thrown from yarnToNpm for non-existent path'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('error => no package.json', async t => {
  t.plan(2)
  try {
    const path = `${fixtures}/no-package-json`
    t.throws(
      () => npmToYarn(path),
      /no such file or directory/,
      'proper error thrown from npmToYarn for non-existent path'
    )
    t.throws(
      () => yarnToNpm(path),
      /no such file or directory/,
      'proper error thrown from yarnToNpm for non-existent path'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('error => no source files', async t => {
  t.plan(2)
  try {
    const path = `${fixtures}/no-source-files`
    t.throws(
      () => npmToYarn(path),
      /no such file or directory/,
      'proper error thrown from npmToYarn for non-existent path'
    )
    t.throws(
      () => yarnToNpm(path),
      /no such file or directory/,
      'proper error thrown from yarnToNpm for non-existent path'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('warn if `--with-workspace` flag is missed', async t => {
  t.plan(2)
  try {
    const path = `${fixtures}/yarn-workspace`
    const warning = 'Workspace (npm lockfile v2) support is experimental. Pass `--with-workspace` flag to enable and cross your fingers. Good luck!'

    sinon.spy(console, 'warn')
    npmToYarn(path)
    yarnToNpm(path)

    t.ok(
      console.warn.alwaysCalledWithExactly(warning),
      'console prints same warning for npmToYarn & yarnToNpm calls'
    )

    t.ok(
      console.warn.calledTwice,
      'console prints warning each time when it`s required'
    )

    console.warn.restore()
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate package-lock to yarn.lock when integrity url hash is absent, but integrity field is present', async t => {
  try {
    t.plan(1)
    const path = `${fixtures}/integrity-is-absent`
    const yarnLockSnap = fs.readFileSync(`${path}/.yarn-lock-snapshot`, 'utf-8')
    const yarnLock = npmToYarn(path)

    t.deepEquals(
      lockfile.parse(yarnLock),
      lockfile.parse(yarnLockSnap),
      'result is equal to yarn.lock snapshot'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock.json and vice versa when integrity contains several hashes', async t => {
  try {
    t.plan(2)
    const path = `${fixtures}/integrity-mix`
    const packageLockSnap = fs.readFileSync(`${path}/.package-lock-snapshot.json`, 'utf-8')
    const yarnLockSnap = fs.readFileSync(`${path}/.yarn-lock-snapshot`, 'utf-8')

    fs.writeFileSync(`${path}/yarn.lock`, yarnLockSnap)
    const pkgLock = yarnToNpm(path)

    t.deepEquals(
      JSON.parse(pkgLock),
      JSON.parse(packageLockSnap),
      'result is equal to package-lock.json snapshot'
    )

    fs.writeFileSync(`${path}/package-lock.json`, packageLockSnap)
    const yarnLock = npmToYarn(path)
    t.deepEquals(
      lockfile.parse(yarnLock),
      lockfile.parse(yarnLockSnap),
      'result is equal to yarn.lock snapshot'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with tarball', async t => {
  try {
    t.plan(1)
    const path = `${fixtures}/tarball-deps`
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

test('translate yarn.lock to package-lock with git+https', async t => {
  try {
    t.plan(1)
    const path = `${fixtures}/git-deps`
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

test('translate yarn.lock to package-lock with file', async t => {
  try {
    t.plan(1)
    const path = `${fixtures}/file-deps-yarn`
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

test('translate package-lock to yarn.lock with file', async t => {
  try {
    t.plan(1)
    const path = `${fixtures}/file-deps-npm`
    const yarnLock = fs.readFileSync(`${path}/.yarn-lock-snapshot`, 'utf-8')
    const res = npmToYarn(path)
    t.deepEquals(
      lockfile.parse(res),
      lockfile.parse(yarnLock),
      'result is equal to yarn.lock snapshot'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock with workspaces to package-lock and vice versa', async t => {
  try {
    t.plan(2)
    const path = `${fixtures}/yarn-workspace`
    const packageLockSnap = fs.readFileSync(`${path}/.package-lock-snapshot.json`, 'utf-8')
    const yarnLockSnap = fs.readFileSync(`${path}/.yarn-lock-snapshot`, 'utf-8')
    const withWorkspace = true

    fs.writeFileSync(`${path}/yarn.lock`, yarnLockSnap)
    const packageLock = yarnToNpm(path, withWorkspace)
    t.deepEquals(
      JSON.parse(packageLock),
      JSON.parse(packageLockSnap),
      'result is equal to package-lock.json snapshot'
    )

    fs.writeFileSync(`${path}/package-lock.json`, packageLockSnap)
    const yarnLock = npmToYarn(path, withWorkspace)
    t.deepEquals(
      lockfile.parse(yarnLock),
      lockfile.parse(yarnLockSnap),
      'result is equal to yarn.lock snapshot'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock.json for workspaces with cross-refs ', async t => {
  try {
    t.plan(2)
    const path = `${fixtures}/yarn-workspace-with-cross-refs`
    const packageLockSnap = fs.readFileSync(`${path}/.package-lock-snapshot.json`, 'utf-8')
    const yarnLockSnap = fs.readFileSync(`${path}/.yarn-lock-snapshot`, 'utf-8')
    const withWorkspace = true

    fs.writeFileSync(`${path}/yarn.lock`, yarnLockSnap)
    const packageLock = yarnToNpm(path, withWorkspace)

    t.deepEquals(
      JSON.parse(packageLock),
      JSON.parse(packageLockSnap),
      'result is equal to package-lock.json snapshot'
    )

    fs.writeFileSync(`${path}/package-lock.json`, packageLockSnap)
    const yarnLock = npmToYarn(path, withWorkspace)

    t.deepEquals(
      lockfile.parse(yarnLock),
      lockfile.parse(yarnLockSnap),
      'result is equal to yarn.lock snapshot'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('handle composite version notation in package.json', async t => {
  try {
    t.plan(2)
    const path = `${fixtures}/composite-pkg-version`
    const packageLockSnap = fs.readFileSync(`${path}/.package-lock-snapshot.json`, 'utf-8')
    const yarnLockSnap = fs.readFileSync(`${path}/.yarn-lock-snapshot`, 'utf-8')

    fs.writeFileSync(`${path}/yarn.lock`, yarnLockSnap)
    const pkgLock = yarnToNpm(path)

    t.deepEquals(
      JSON.parse(pkgLock),
      JSON.parse(packageLockSnap),
      'result is equal to package-lock.json snapshot'
    )

    fs.writeFileSync(`${path}/package-lock.json`, packageLockSnap)
    const yarnLock = npmToYarn(path)
    t.deepEquals(
      lockfile.parse(yarnLock),
      lockfile.parse(yarnLockSnap),
      'result is equal to yarn.lock snapshot'
    )
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})
