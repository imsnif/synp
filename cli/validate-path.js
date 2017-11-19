'use strict'
const fs = require('fs')
const path = require('path')
const colors = require('colors')

module.exports = function validatePath (program) {
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
  if (!nodeModulesStats || !nodeModulesStats.isDirectory()) {
    console.error(
      colors.red(`node_modules directory does not exist in path ${sourcePath}`)
    )
    program.outputHelp()
    process.exit(2)
  }
}
