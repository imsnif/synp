'use strict'

const { stringManifestFetcher } = require('./manifest-fetcher')

async function createTreeManifest ({
  manifest,
  yarnObject,
  manifests = {},
  getManifest = stringManifestFetcher()
}) {
  const { dependencies, devDependencies } = manifest
  const allDeps = Object.assign({}, dependencies || {})
  return Object.keys(allDeps).reduce(async (manifestsPromise, depName) => {
    const manifests = await manifestsPromise // TODO: naming
    const depSemver = allDeps[depName]
    if (!yarnObject[`${depName}@${depSemver}`]) {
      // eg. fsevents
      console.log('bailing on:', `${depName}@${depSemver}`)
      return manifests
    }
    const { version } = yarnObject[`${depName}@${depSemver}`]
    if (manifests[depName] && manifests[depName][version]) return manifests
    console.log('getting manifest for;', `${depName}@${version}`)
    const depManifest = await getManifest(`${depName}@${version}`)
    manifests[depName] = manifests[depName] || {}
    manifests[depName][version] = depManifest
    return createTreeManifest({manifest: depManifest, yarnObject, manifests})
  }, Promise.resolve(manifests))
}

module.exports = {createTreeManifest}
