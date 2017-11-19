#!/usr/bin/env node
'use strict'
const program = require('commander')
const { version } = require('../package.json')

const run = require('./run')

program
  .version(version)
  .option('-s, --source-file [source-file]', 'The path to the yarn.lock or package-lock.json to be converted')
  .parse(process.argv)

run(program)
