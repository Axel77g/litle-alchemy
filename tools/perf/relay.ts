// Relais de perf (serveur de dev seulement) : reçoit les échantillons de l'appareil par le WebSocket de HMR de Vite
// (src/debug/livePerf.tsx, événement « perf:sample ») et les diffuse en SSE à la page /__perf (tools/perf/dashboard.html).
// Sens inverse : le dashboard POST /__perf/switch, le relais note la valeur voulue et la pousse à l'appareil (événement « perf:switches »).
import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import type { Plugin, WebSocketClient } from 'vite'

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
  defs: unknown[] // catalogue des interrupteurs, annoncé par l'appareil
  desired: Record<string, string> // valeurs voulues : renvoyées à l'appareil s'il se recharge
}
interface Hello {
  dev: string
  name: string
  defs: unknown[]
}
interface SwitchOrder {
  dev: string
  key?: string
  value?: string
  reset?: boolean
}

const dashboardPath = fileURLToPath(new URL('./dashboard.html', import.meta.url))

export function perfRelay(): Plugin {
  return {
    name: 'perf-relay',
    apply: 'serve',
    configureServer(server) {
      const devices = new Map<string, Device>()
      const clients = new Map<string, WebSocketClient>() // la liaison HMR de chaque appareil (pas sérialisable : hors de Device)
      const streams = new Set<ServerResponse>()
      const send = (res: ServerResponse, event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

      const deviceOf = (dev: string, name: string) => {
        const device = devices.get(dev) ?? { name, samples: [], defs: [], desired: {} }
        device.name = name
        devices.set(dev, device)
        return device
      }

      server.ws.on('perf:hello', (data: Hello, client: WebSocketClient) => {
        const device = deviceOf(data.dev, data.name)
        device.defs = data.defs
        clients.set(data.dev, client)
        if (Object.keys(device.desired).length) client.send('perf:switches', device.desired) // page rechargée : on lui rend son état
        for (const res of streams) send(res, 'hello', { dev: data.dev, name: data.name, defs: data.defs })
      })

      server.ws.on('perf:sample', (data: Sample) => {
        const sample = { ...data, ts: Date.now() }
        const device = deviceOf(sample.dev, sample.name)
        device.samples.push(sample)
        if (device.samples.length > HISTORY) device.samples.shift()
        for (const res of streams) send(res, 'sample', sample)
      })

      // /__perf : la page ; /__perf/stream : le flux d'échantillons (l'historique d'abord, puis le direct)
      server.middlewares.use('/__perf', (request, response) => {
        // les types de connect passent par `http`, absent ici : on retype avec nos déclarations minimales
        const req = request as IncomingMessage
        const res = response as ServerResponse
        const path = (req.url ?? '/').split('?')[0]
        if (path === '/switch' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', () => {
            let order: SwitchOrder
            try {
              order = JSON.parse(body)
            } catch {
              res.writeHead(400)
              return res.end('JSON invalide')
            }
            const device = devices.get(order.dev)
            const client = clients.get(order.dev)
            if (!device || !client) {
              res.writeHead(409)
              return res.end('appareil inconnu ou déconnecté')
            }
            if (order.reset) device.desired = {}
            else if (order.key && order.value !== undefined) device.desired = { ...device.desired, [order.key]: order.value }
            client.send('perf:switches', device.desired)
            res.writeHead(204)
            res.end()
          })
          return
        }
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
