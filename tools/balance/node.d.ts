// Le projet n'a pas @types/node : on déclare juste ce que l'outil utilise.
declare module 'node:fs' {
  export function writeFileSync(path: string, data: string): void
  export function readFileSync(path: string, encoding: 'utf8'): string
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void
}
declare const process: { argv: string[]; exit(code?: number): never }
