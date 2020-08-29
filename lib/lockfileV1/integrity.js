'use strict'

module.exports = {
  sha1ToHexChecksum (sha1) {
    return sha1
      ? Buffer.from(sha1, 'base64').toString('hex')
      : undefined
  },
  hexChecksumToSha1 (hexChecksum) {
    const decoded = Buffer.from(hexChecksum, 'hex').toString('base64')

    return decoded.length === 28
      ? 'sha1-' + decoded
      : undefined
  },

  // NOTE npm lockfile may handle several hashes in a single field
  formatNpmIntegrity (...integrities) {
    return Object.keys(integrities.reduce((memo, str) => {
      str && str.split(' ').forEach((integrity) => {
        memo[integrity] = integrity
      })

      return memo
    }, {})).join(' ') || undefined
  },
  parseIntegrity (integrity) {
    if (!integrity) {
      return {}
    }

    const chunks = integrity.split(' ')

    return chunks.reduce((memo, hash) => {
      const key = /^sha1-/.test(hash) ? 'sha1' : 'sha512'
      const value = hash.slice(key.length + 1)

      memo[key] = value

      return memo
    }, {})
  },
  formatYarnIntegrity (hash) {
    if (!hash) {
      return undefined
    }

    return hash.length === 28
      ? 'sha1-' + hash
      : 'sha512-' + hash
  }
}
