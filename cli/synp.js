#!/usr/bin/env node
'use strict'
const fs = require('fs')
const path = require('path')
const program = require('commander')
const colors = require('colors')
const { version } = require('../package.json')

const { npmToYarn, yarnToNpm } = require('../')

function validateArgs (program, sourceFileName) {
  const { sourceFile } = program
  if (!sourceFile) {
    console.error(colors.red('source-file is required'))
    program.outputHelp()
    process.exit(2)
  }
  if (
    sourceFileName !== 'yarn.lock' &&
    sourceFileName !== 'package-lock.json'
  ) {
    console.error(
      colors.red(`source-file must be either yarn.lock or package-lock.json, received ${sourceFile}`)
    )
    program.outputHelp()
    process.exit(2)
  }
}

function validatePath (program) {
  const { sourceFile } = program
  const sourceFileName = sourceFile.split(path.sep).pop()
  const sourcePath = sourceFile.split(path.sep).slice(0, -1).join(path.sep)
  const destFileName = sourceFileName === 'yarn.lock' ? 'package-lock.json' : 'yarn.lock'
  const destFile = path.join(sourcePath, destFileName)
  const nodeModulesPath = path.join(sourcePath, 'node_modules')
  const nodeModulesStats = fs.existsSync(nodeModulesPath) && fs.statSync(nodeModulesPath)
  const sourceStats = fs.existsSync(sourceFile) && fs.statSync(sourceFile)
  if (!sourceStats || !sourceStats.isFile()) {
    console.error(
      colors.red(`source-file ${sourceFile} does not exist`)
    )
    program.outputHelp()
    process.exit(2)
  }
  if (fs.existsSync(destFile)) {
    console.error(
      colors.red(`destination file ${destFile} already exists, will not overwrite`)
    )
    program.outputHelp()
    process.exit(2)
  }
  if (!nodeModulesPath || !nodeModulesStats.isDirectory()) {
    console.error(
      colors.red(`node_modules directory does not exist in path ${sourcePath}`)
    )
    program.outputHelp()
    process.exit(2)
  }
}

function writeOutput (output, destinationFile) {
  if (/yarn.lock$/.test(destinationFile)) {
    fs.writeFileSync(destinationFile, output)
  } else {
    const beautified = JSON.stringify(JSON.parse(output), false, 2)
    fs.writeFileSync(destinationFile, beautified)
  }
}

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
