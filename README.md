# synp
Convert `yarn.lock` to `package-lock.json` and vice versa.

### install
`npm install -g synp` - for the cli tool
`npm install synp` / `yarn add synp` for the `require`-able library

### command line usage
```bash
yarn # be sure the relevant node_modules folder exists and is updated
synp --source-file /path/to/yarn.lock # will create /path/to/package-lock.json
```
```bash
npm install # be sure the relevant node_modules folder exists and is updated                                                                                                                                                                   
synp --source-file /path/to/package-lock.json # will create /path/to/yarn.lock
```

### programmatic usage
```javascript
const { npmToYarn, yarnToNpm } = require('synp')

const libPath = '/path/to/my/lib'
const stringifiedYarnLock = npmToYarn(libPath)
const stringifiedPackageLock = yarnToNpm(libPath)
```

### how does it work?
Since `package-lock.json` and `yarn.lock` use different methods in order to deterministically lock down dependency versions, oftentimes they do not contain all the information needed to be purely converted.

For this reason, `synp` uses the existing `node_modules` directory of the package to determine the package state and assist in the conversion.

For this reason, it is vital to make sure the `node_modules` directory of the package is current and was installed by the respective tool (eg. by `yarn` if converting to `package-lock.json` and by `npm` if converting to `yarn.lock`).
### caveats
**Bundled dependencies**: For various reasons, this tool does not 'play well' with bundled dependencies. This should not be a problem because installing the packages later with the converted file will (by definition) update the proper packages in the file. If this is not the case for you, please open an issue/PR with your use case and I'd be happy to take a look.

**Package checksums**: Both `yarn.lock` and `package-lock.json` include package checksums for dependencies. Since `npm` is slowly moving to `sha-512` checksums which `yarn` does not (yet) support, converting to `package-lock.json` will result in weaker checksums (that will still work!) and converting to `yarn.lock` can sometimes result in a corrupted result file.
Thankfully, this issue is 100% solvable. In `npm` one can update the checksums simply by deleting the `integrity` field of all or relevant packages. In `yarn` this can be solved with the `--update-checksums`* flag when installing from the created file.

**Format limitations**: Some things that can be expressed in one format simply cannot be expressed in the other. These are (to the best of my knowledge) extreme edge cases and should not worry 99% of this tool's intended users. One example is `package-lock.json`'s ability to translate the same semver string to different versions. (eg. one package requesting version `^1.0.1` of a dependency and receiving `1.0.5` and a different package requesting version `^1.0.1` of the *same* dependency and receiving `1.0.71`. When translating to `yarn.lock` through `synp` both will receive the same version).

**Optional packages**: Like `npm` (https://github.com/npm/npm/issues/17722), `synp` also has issues with optional dependencies across different platforms. This is because is uses `node_modules` as its state, and does not guess about packages that are not installed on the converting platform. Sadly, like `npm` the only way to avoid this issue is to perform the conversion on the platform that meets most optional dependencies and update the rest manually. If this is a major issue for you, adding some sort of automatic tooling for this can be discussed.

\* At the time of this writing, the `--update-checksums` flag in `yarn` has been merged but not released yet. Please see: https://github.com/yarnpkg/yarn/pull/4860

### troubleshooting
1. **checksum mismatch** when installing from converted file? In `yarn` use `--update-checksums`, in `npm` delete the `integrity` field from the offending package (have no fear! This will be updated upon installation).
2. **synp failing or not converting properly** - remove the `node_modules` from the package to be converted, install it again (with `yarn` if converting to `package-lock.json` or `npm` if converting to `yarn.lock`) and run `synp` one more time.
3. **something else?** - please open an issue/PR.

### License
MIT
