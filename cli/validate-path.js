'use strict'
const fs = require('fs')
const path = require('path')

module.exports = function validatePath (program) {
  const { sourceFile } = program
  const sourceFileName = sourceFile.split(path.sep).pop()
  const sourcePath = sourceFile.split(path.sep).slice(0, -1).join(path.sep)
  const destFileName = sourceFileName === 'yarn.lock' ? 'package-lock.json' : 'yarn.lock'
  const destFile = path.join(sourcePath, destFileName)
  const sourceStats = fs.existsSync(sourceFile) && fs.statSync(sourceFile)
  if (!sourceStats || !sourceStats.isFile()) {
    throw new Error(`source-file ${sourceFile} does not exist`)
  }
  if (fs.existsSync(destFile)) {
    throw new Error(`destination file ${destFile} already exists, will not overwrite`)
  }
}
