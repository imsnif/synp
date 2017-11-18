#!/usr/bin/env node
'use strict'

const { yarnToNpm } = require('../')
console.log(yarnToNpm(process.argv[2]))
