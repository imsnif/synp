#!/usr/bin/env node
'use strict'
const program = require('commander')
const { version } = require('../package.json')

const run = require('./run')

program
  .version(version)
  .option('-s, --source-file [source-file]', 'The path to the yarn.lock or package-lock.json to be converted')
  .option('-f, --force', 'Force overwrite destination file', false)
  .option('-w, --with-workspace', 'Enable experimental npm lockfile v2 processing', false)
  .exitOverride((err) => {
    if (err.code === 'commander.unknownOption') {
      console.log('use --help for hints')
    }

    return err
  })
  .parse(process.argv)

run(program)
