'use strict'

module.exports = {
  dependenciesForYarn (packageEntry, packageLock) {
    const { name, dependencies, devDependencies, optionalDependencies } = packageEntry
    const depsWithoutOptional = optionalDependencies
      ? Object.keys(dependencies).reduce((deps, depName) => {
        if (optionalDependencies[depName]) return deps
        const entry = dependencies[depName]
        deps[depName] = entry
        return deps
      }, {})
      : dependencies
    const devDeps = name === packageLock.name ? devDependencies : {}
    return { dependencies: depsWithoutOptional, optionalDependencies, devDependencies: devDeps }
  },
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
