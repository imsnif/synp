#!/usr/bin/env node
'use strict'
const path = require('path')
const colors = require('colors')

const synp = require('../')

const validateArgs = require('./validate-args')
const validatePath = require('./validate-path')
const writeOutput = require('./write-output')

module.exports = function run (program) {
  try {
    const options = program.opts()
    const { sourceFile, withWorkspace } = options
    const sourceFileName = sourceFile && sourceFile.split(path.sep).pop()
    validateArgs(options, sourceFileName)
    validatePath(options)

    const convert = sourceFileName === 'yarn.lock'
      ? synp.yarnToNpm
      : synp.npmToYarn
    const sourcePath = sourceFile.split(path.sep).slice(0, -1).join(path.sep)

    const destinationFileName = sourceFileName === 'yarn.lock' ? 'package-lock.json' : 'yarn.lock'
    const destinationPath = sourceFile.split(path.sep).slice(0, -1).join(path.sep)
    const destination = path.join(destinationPath, destinationFileName)
    const output = convert(sourcePath, withWorkspace)
    writeOutput(output, destination)
  } catch (e) {
    console.error(colors.red(e.message))
    program.outputHelp()
    process.exit(2)
  }
}
