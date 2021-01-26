'use strict'

module.exports = {
  dependenciesForYarn (packageEntry, packageLock) {
    const { name, dependencies, devDependencies, optionalDependencies } = packageEntry
    const depsWithoutOptional = optionalDependencies
      ? Object.keys(dependencies || {}).reduce((deps, depName) => {
          if (optionalDependencies[depName]) return deps
          const entry = dependencies[depName]
          deps[depName] = entry
          return deps
        }, {})
      : dependencies || {}
    const devDeps = name === packageLock.name ? devDependencies : {}
    return { dependencies: depsWithoutOptional, optionalDependencies, devDependencies: devDeps }
  },
  npmRequires (dependencies, yarnObject, nodeModulesTree) {
    return Object.keys(dependencies).reduce((requires, depName) => {
      const depSemver = dependencies[depName]
      const yarnEntry = yarnObject[`${depName}@${depSemver}`]

      // Found in yarn.lock
      if (!yarnEntry) {
        return requires // fsevents, etc.
      }

      // Exists in node_modules
      if (!Object.keys(nodeModulesTree).find((mPath) => mPath.endsWith(`node_modules/${depName}`))) {
        return requires
      }

      requires[depName] = dependencies[depName] // NOTE Save the version as it required, not as resolved
      return requires
    }, {})
  }
}
