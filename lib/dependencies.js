'use strict'

module.exports = {
  npmRequires (dependencies, yarnObject) {
    return Object.keys(dependencies).reduce((requires, depName) => {
      const depSemver = dependencies[depName]
      const yarnEntry = yarnObject[`${depName}@${depSemver}`]
      if (!yarnEntry) return requires // fsevents, etc.
      requires[depName] = yarnEntry.version
      return requires
    }, {})
  }
}
