'use strict'

const os = require('os')
const Queue = require('promise-queue')
const pacote = require('pacote')

function getManifest (node, packageJson, queue) {
  const { name, version } = node
  if (node.isRoot) return Promise.resolve(packageJson)
  return queue.add(() => pacote.manifest(`${name}@${version}`, {
    cache: os.tmpdir()
  }))
}

module.exports = {
  manifestFetcher (packageJson) {
    const queue = new Queue(10, Infinity)
    return (node) => getManifest(node, packageJson, queue)
  }
}
