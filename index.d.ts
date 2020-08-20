declare module 'synp' {
  export function yarnToNpm(packageDir: string, withWorkspace?: boolean): string
  export function npmToYarn(packageDir: string, withWorkspace?: boolean): string
}
