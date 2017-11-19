#!/usr/bin/env node
'use strict'
const fs = require('fs')
const path = require('path')
const program = require('commander')
const colors = require('colors')
const { version } = require('../package.json')

const { npmToYarn, yarnToNpm } = require('../')

const validateArgs = require('./validate-args')
const validatePath = require('./validate-path')
const writeOutput = require('./write-output')

program
  .version(version)
  .option('-s, --source-file [source-file]', 'The path to the yarn.lock or package-lock.json to be converted')
  .parse(process.argv)

const { sourceFile } = program
const sourceFileName = sourceFile.split(path.sep).pop()
const convert = sourceFileName === 'yarn.lock'
  ? yarnToNpm
  : npmToYarn
const sourcePath = sourceFile.split(path.sep).slice(0, -1).join(path.sep)
validateArgs(program, sourceFileName)
validatePath(program)
const destinationFileName = sourceFileName === 'yarn.lock' ? 'package-lock.json' : 'yarn.lock'
const destinationPath = sourceFile.split(path.sep).slice(0, -1).join(path.sep)
const destination = path.join(destinationPath, destinationFileName)
const output = convert(sourcePath)
writeOutput(output, destination)
