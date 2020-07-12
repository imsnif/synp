declare module 'synp' {
  export function yarnToNpm(packageDir: string): string
  export function npmToYarn(packageDir: string): string
}
