// Pas de @types/node (voir tools/balance/node.d.ts) : on déclare juste ce que le relais de perf utilise.
declare module 'node:http' {
  export interface IncomingMessage {
    url?: string
    on(event: 'close', listener: () => void): this
  }
  export interface ServerResponse {
    write(chunk: string): boolean
    writeHead(status: number, headers?: Record<string, string>): this
    end(chunk?: string): void
  }
}
declare module 'node:url' {
  export function fileURLToPath(url: URL | string): string
}
