'use strict'

module.exports = function validateArgs (program, sourceFileName) {
  const { sourceFile } = program
  if (!sourceFile) {
    throw new Error('source-file is required')
  }
  if (
    sourceFileName !== 'yarn.lock' &&
    sourceFileName !== 'package-lock.json'
  ) {
    throw new Error(
      `source-file must be either yarn.lock or package-lock.json, received ${sourceFile}`
    )
  }
}
