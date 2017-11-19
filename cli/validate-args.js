'use strict'

const colors = require('colors')

module.exports = function validateArgs (program, sourceFileName) {
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
