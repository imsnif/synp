const test = require('tape')
const fs = require('fs')
const lockfile = require('@yarnpkg/lockfile')
const { yarnToNpm, npmToYarn } = require('../')

function findNonSha1Hashes ({dependencies, memo = []}) {
  return Object.keys(dependencies).reduce((memo, packageName) => {
    if (!/^sha1-/.test(dependencies[packageName].integrity)) {
      memo.push(dependencies[packageName].resolved)
    }
    if (dependencies[packageName].dependencies) {
      findNonSha1Hashes({dependencies: dependencies[packageName].dependencies, memo})
    }
    return memo
  }, memo)
}

function replaceNonSha1 (yarnObj, resolvedWithNonSha1Hashes) {
  return Object.assign({}, yarnObj, {object:
    Object.keys(yarnObj.object).reduce((memo, packageName) => {
      const entry = yarnObj.object[packageName]
      const strippedResolved = entry.resolved.replace(/#.+?$/, '')
      if (resolvedWithNonSha1Hashes.indexOf(strippedResolved) !== -1) {
        memo[packageName] = Object.assign({}, entry, {resolved: `${strippedResolved}#N/A`})
      } else {
        memo[packageName] = entry
      }
      return memo
    }, {})
  })
}

function normalizePackageLock (npmObj, resolvedWithNonSha1Hashes) {
  return Object.assign({}, npmObj, {dependencies:
    Object.keys(npmObj.dependencies).reduce((memo, packageName) => {
      const entry = npmObj.dependencies[packageName]
      if (resolvedWithNonSha1Hashes.indexOf(entry.resolved) !== -1) {
        memo[packageName] = Object.assign({}, entry, {integrity: `N/A`})
      } else {
        memo[packageName] = entry
      }
      if (entry.dependencies && Object.keys(entry.dependencies).length > 0) {
        const { dependencies } = normalizePackageLock(entry, resolvedWithNonSha1Hashes)
        memo[packageName] = Object.assign({}, memo[packageName], {dependencies})
      }
      delete memo[packageName].optional // see caveats in README
      return memo
    }, {})
  })
}

test('translate with one root dependency', async t => {
  t.plan(2)
  try {
    const path = `${__dirname}/fixtures/single-root-dep`
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    t.deepEquals(JSON.parse(yarnToNpm(path)), JSON.parse(packageLock), 'can convert yarn to npm')
    t.deepEquals(lockfile.parse(npmToYarn(path)), lockfile.parse(yarnLock), 'can convert npm to yarn')
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
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const res = lockfile.parse(npmToYarn(path).replace(/registry.yarnpkg.com/g, 'registry.npmjs.org'))
    const yarnLockWithNpmRegistry = yarnLock.replace(/registry.yarnpkg.com/g, 'registry.npmjs.org')
    const yarnLockObject = lockfile.parse(yarnLockWithNpmRegistry)
    const { dependencies } = JSON.parse(packageLock)
    const resolvedWithNonSha1Hashes = findNonSha1Hashes({dependencies})
    const yarnLockObjReplaced = replaceNonSha1(yarnLockObject, resolvedWithNonSha1Hashes)
    const resReplaced = replaceNonSha1(res, resolvedWithNonSha1Hashes)
    t.deepEquals(resReplaced, yarnLockObjReplaced, 'result is equal to yarn.lock file')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with multiple-level dependencies', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/multiple-level-deps`
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const res = yarnToNpm(path).replace(/registry.yarnpkg.com/g, 'registry.npmjs.org')
    const resParsed = JSON.parse(res)
    const packageLockParsed = JSON.parse(packageLock)
    const resolvedWithNonSha1Hashes = findNonSha1Hashes({dependencies: packageLockParsed.dependencies}) // TODO: name
    const resReplaced = normalizePackageLock(resParsed, resolvedWithNonSha1Hashes)
    const packageLockReplaced = normalizePackageLock(packageLockParsed, resolvedWithNonSha1Hashes)
    t.deepEquals(resReplaced, packageLockReplaced, 'result is equal to yarn.lock file')
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
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const res = lockfile.parse(npmToYarn(path).replace(/registry.yarnpkg.com/g, 'registry.npmjs.org'))
    const yarnLockWithNpmRegistry = yarnLock.replace(/registry.yarnpkg.com/g, 'registry.npmjs.org')
    const yarnLockObject = lockfile.parse(yarnLockWithNpmRegistry)
    const { dependencies } = JSON.parse(packageLock)
    const resolvedWithNonSha1Hashes = findNonSha1Hashes({dependencies})
    const yarnLockObjReplaced = replaceNonSha1(yarnLockObject, resolvedWithNonSha1Hashes)
    const resReplaced = replaceNonSha1(res, resolvedWithNonSha1Hashes)
    t.deepEquals(resReplaced.object, yarnLockObjReplaced.object, 'result is equal to yarn.lock file')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})

test('translate yarn.lock to package-lock with scopes', async t => {
  try {
    t.plan(1)
    const path = `${__dirname}/fixtures/deps-with-scopes`
    const yarnLock = fs.readFileSync(`${path}/yarn.lock`, 'utf-8')
    const packageLock = fs.readFileSync(`${path}/package-lock.json`, 'utf-8')
    const res = yarnToNpm(path).replace(/registry.yarnpkg.com/g, 'registry.npmjs.org')
    const resParsed = JSON.parse(res)
    const packageLockParsed = JSON.parse(packageLock)
    const resolvedWithNonSha1Hashes = findNonSha1Hashes({dependencies: packageLockParsed.dependencies}) // TODO: name
    const resReplaced = normalizePackageLock(resParsed, resolvedWithNonSha1Hashes)
    const packageLockReplaced = normalizePackageLock(packageLockParsed, resolvedWithNonSha1Hashes)
    t.deepEquals(resReplaced, packageLockReplaced, 'result is equal to package-lock.json file')
  } catch (e) {
    t.fail(e.stack)
    t.end()
  }
})
