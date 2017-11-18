#!/usr/bin/env node
'use strict'

const { npmToYarn } = require('../')
console.log(npmToYarn(process.argv[2]))
