module.exports = {
  convertYarnToNpmV2(yarnLock, name, version, packageDir) {
    throw new Error('yarn "workspaces" require npm lockfileVersion v2, but it is not supported yet')
  },
  convertNpmV2ToYarn() {
    throw new Error('npm lockfileVersion v2 is not supported yet')
  },
}
