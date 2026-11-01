// Relais de perf (serveur de dev seulement) : reçoit les échantillons de l'appareil par le WebSocket de HMR de Vite
// (src/debug/livePerf.tsx, événement « perf:sample ») et les diffuse en SSE à la page /__perf (tools/perf/dashboard.html).
import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const HISTORY = 300 // échantillons gardés par appareil (5 min) : un dashboard ouvert en retard retrouve les courbes
const PING_MS = 15_000

interface Sample {
  dev: string
  name: string
  [key: string]: unknown
}
interface Device {
  name: string
  samples: Sample[]
}

const dashboardPath = fileURLToPath(new URL('./dashboard.html', import.meta.url))

export function perfRelay(): Plugin {
  return {
    name: 'perf-relay',
    apply: 'serve',
    configureServer(server) {
      const devices = new Map<string, Device>()
      const streams = new Set<ServerResponse>()
      const send = (res: ServerResponse, event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

      server.ws.on('perf:sample', (data: Sample) => {
        const sample = { ...data, ts: Date.now() }
        const device = devices.get(sample.dev) ?? { name: sample.name, samples: [] }
        device.name = sample.name
        device.samples.push(sample)
        if (device.samples.length > HISTORY) device.samples.shift()
        devices.set(sample.dev, device)
        for (const res of streams) send(res, 'sample', sample)
      })

      // /__perf : la page ; /__perf/stream : le flux d'échantillons (l'historique d'abord, puis le direct)
      server.middlewares.use('/__perf', (request, response) => {
        // les types de connect passent par `http`, absent ici : on retype avec nos déclarations minimales
        const req = request as IncomingMessage
        const res = response as ServerResponse
        const path = (req.url ?? '/').split('?')[0]
        if (path === '/stream') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
          send(res, 'init', Object.fromEntries(devices))
          streams.add(res)
          const ping = setInterval(() => res.write(': ping\n\n'), PING_MS)
          req.on('close', () => {
            clearInterval(ping)
            streams.delete(res)
          })
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
        res.end(readFileSync(dashboardPath, 'utf8')) // relu à chaque requête : on peut modifier la page sans relancer Vite
      })

      // Rappelle l'adresse du dashboard et le lien à ouvrir sur le téléphone, sous les adresses de Vite
      const printUrls = server.printUrls.bind(server)
      server.printUrls = () => {
        printUrls()
        const { local, network } = server.resolvedUrls ?? { local: [], network: [] }
        console.log(`  \x1b[36m➜\x1b[0m  Perf dashboard: ${local[0] ?? 'http://localhost:5173/'}__perf`)
        for (const url of network) console.log(`  \x1b[36m➜\x1b[0m  Perf téléphone:  ${url}?perf`)
      }
    },
  }
}
