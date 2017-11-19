'use strict'
const fs = require('fs')

module.exports = function writeOutput (output, destinationFile) {
  if (/yarn.lock$/.test(destinationFile)) {
    fs.writeFileSync(destinationFile, output)
  } else {
    const beautified = JSON.stringify(JSON.parse(output), false, 2)
    fs.writeFileSync(destinationFile, beautified)
  }
  console.log(`Created ${destinationFile}`)
  process.exit(0)
}
