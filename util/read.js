'use strict'

const { readFileSync } = require('fs')

module.exports = {
  read (path, skipParse) {
    const contents = readFileSync(path).toString('utf-8')

    return skipParse ? contents : JSON.parse(contents.trim())
  }
}
