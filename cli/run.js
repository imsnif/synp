#!/usr/bin/env node
'use strict'
const path = require('path')
const colors = require('colors')
const { Spinner } = require('cli-spinner')

const synp = require('../')

const validateArgs = require('./validate-args')
const validatePath = require('./validate-path')
const writeOutput = require('./write-output')

module.exports = async function run (program) {
  try {
    const { sourceFile } = program
    const sourceFileName = sourceFile && sourceFile.split(path.sep).pop()
    validateArgs(program, sourceFileName)
    const convert = sourceFileName === 'yarn.lock'
      ? synp.yarnToNpm
      : synp.npmToYarn
    const sourcePath = sourceFile.split(path.sep).slice(0, -1).join(path.sep)
    validatePath(program)
    const destinationFileName = sourceFileName === 'yarn.lock' ? 'package-lock.json' : 'yarn.lock'
    const destinationPath = sourceFile.split(path.sep).slice(0, -1).join(path.sep)
    const destination = path.join(destinationPath, destinationFileName)
    const progressSpinner = new Spinner()
    progressSpinner.start()
    const output = await convert(sourcePath, (str) => progressSpinner.setSpinnerTitle(str))
    progressSpinner.stop(true)
    writeOutput(output, destination)
  } catch (e) {
    console.error(colors.red(e.message))
    program.outputHelp()
    process.exit(2)
  }
}
