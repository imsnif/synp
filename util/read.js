'use strict'

const {readFileSync} = require('fs')

module.exports = {
  readJson(path) {
    return JSON.parse(readFileSync(path).toString('utf-8').trim())
  }
}
