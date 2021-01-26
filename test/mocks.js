'use strict'

const fs = require('fs')
const sinon = require('sinon')
const synp = require('../')

module.exports = {
  mocks ({
    sandbox,
    packagePath,
    yarnPath,
    pLockPath,
    yarnExists,
    pLockExists,
    nodeModulesExists = true,
    yarnIsDir = false,
    nodeModulesIsFile = false
  }) {
    const fsExists = sandbox.stub(fs, 'existsSync')
    const statSync = sandbox.stub(fs, 'statSync')
    sandbox.stub(fs, 'writeFileSync')
    sandbox.stub(process, 'exit')
    fsExists.withArgs(`${packagePath}/package-lock.json`).returns(pLockExists)
    fsExists.withArgs(`${yarnPath}`).returns(yarnExists)
    fsExists.withArgs(`${packagePath}/node_modules`).returns(nodeModulesExists)
    statSync.withArgs(`${packagePath}/node_modules`).returns({
      isDirectory: () => !nodeModulesIsFile
    })
    statSync.withArgs(yarnPath).returns({
      isFile: () => !yarnIsDir
    })
    statSync.withArgs(pLockPath).returns({
      isFile: () => true
    })
    sandbox.stub(synp, 'yarnToNpm')
      .returns('{"mockedResult": "mockedResult"}')
    sandbox.stub(synp, 'npmToYarn')
      .returns('{"mockedResult": "mockedResult"}')
  },
  mockProgram (sourceFile, force = false) {
    return {
      opts () {
        return {
          sourceFile,
          force
        }
      },
      outputHelp: sinon.spy()
    }
  }
}
