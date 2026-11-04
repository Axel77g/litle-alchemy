// Coque Electron : ouvre une fenêtre qui charge le build du jeu (dist-electron). Le jeu ne sait pas qu'il est dans Electron.
//
// Le build est servi par un protocole custom `app://` et non par `file://` :
//  - sous `file://`, Chromium bloque fetch(), or three.js charge les .glb et l'audio par fetch ;
//  - `app://game` est une origine stable et sécurisée : le localStorage (la sauvegarde) y persiste d'un lancement à l'autre.
import { app, BrowserWindow, net, protocol, shell } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// Paquet installé : le build est copié dans les ressources (voir electron-builder.yml) ; en développement, il est à la racine du dépôt
const webRoot = app.isPackaged ? path.join(process.resourcesPath, 'game') : path.resolve(here, '../../dist-electron')
const devUrl = process.env.ELECTRON_DEV_URL // serveur Vite (HMR) : `npm run electron:dev`
const ORIGIN = 'app://game'

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    // Chemin normalisé sous webRoot : impossible de sortir du dossier du jeu (../)
    const file = path.normalize(path.join(webRoot, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)))
    if (!file.startsWith(webRoot) || !existsSync(file)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 860,
    minWidth: 320,
    minHeight: 480,
    backgroundColor: '#140a04',
    show: false,
    webPreferences: {
      preload: path.join(here, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required', // le son démarre sans attendre un clic (le jeu gère déjà son propre déblocage)
      backgroundThrottling: false, // fenêtre masquée : la boucle de jeu (setInterval) ne doit pas être ralentie
    },
  })
  win.once('ready-to-show', () => win.show())

  const isGame = (url) => url.startsWith(ORIGIN) || (devUrl && url.startsWith(devUrl))
  // Un lien externe s'ouvre dans le navigateur ; la fenêtre du jeu ne navigue jamais ailleurs
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!isGame(url)) event.preventDefault()
  })

  win.loadURL(devUrl ?? `${ORIGIN}/index.html`)
}

app.whenReady().then(() => {
  registerAppProtocol()
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
