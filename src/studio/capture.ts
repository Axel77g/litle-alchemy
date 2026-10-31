// Capture d'un modèle 3D en icône : rendu sur fond transparent par un second renderer (indépendant de l'aperçu live),
// recadrage sur le contenu réel (boîte alpha), puis « sticker » 2D : contour blanc épais, liseré sombre, ombre.
import * as THREE from 'three'

export interface StudioOptions {
  size: number // côté de l'image finale (px)
  padding: number // marge autour du sticker (px, pour une image de 512 : mis à l'échelle pour les autres tailles)
  outline: number // épaisseur du contour (px @512)
  outlineColor: string
  border: number // liseré extérieur sombre, au-delà du contour (px @512), 0 = aucun
  borderColor: string
  hardShadow: number // ombre pleine décalée vers le bas, comme drop-shadow(0 4px 0 #000) (px @512), 0 = aucune
  softShadow: boolean // ombre douce sous le sticker
  azimuth: number // degrés : 45 = l'angle de la caméra du jeu
  elevation: number // degrés : 39.5 = l'angle de la caméra du jeu
  light: number // multiplicateur de la lumière
  aces: boolean // tone mapping ACES comme le jeu (couleurs un peu plus ternes) ; sinon couleurs franches
}

export const DEFAULT_OPTIONS: StudioOptions = {
  size: 512,
  padding: 14,
  outline: 14,
  outlineColor: '#ffffff',
  border: 5,
  borderColor: '#1a1326',
  hardShadow: 8,
  softShadow: false,
  azimuth: 45,
  elevation: 39.5,
  light: 1.6,
  aces: false,
}

const RENDER_SCALE = 2 // le rendu fait 2× la taille finale : le recadrage puis la réduction lissent les bords
const CAMERA_DISTANCE = 30
const rad = THREE.MathUtils.degToRad

// Place une caméra orthographique autour de `target` et la cadre pour que sa boîte englobante entre entière (carré)
export function frameCamera(camera: THREE.OrthographicCamera, target: THREE.Object3D, azimuth: number, elevation: number) {
  target.updateMatrixWorld(true)
  // Les particules (étincelles du feu de camp) sont exclues du cadrage : leur volume est bien plus grand que le modèle
  const box = new THREE.Box3()
  target.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) box.union(new THREE.Box3().setFromObject(obj, true))
  })
  if (box.isEmpty()) return
  const center = box.getCenter(new THREE.Vector3())
  const az = rad(azimuth)
  const el = rad(elevation)
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  camera.up.set(0, 1, 0)
  camera.position.copy(center).addScaledVector(dir, CAMERA_DISTANCE)
  camera.lookAt(center)
  camera.updateMatrixWorld(true)

  let half = 0
  const corner = new THREE.Vector3()
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(camera.matrixWorldInverse)
    half = Math.max(half, Math.abs(corner.x), Math.abs(corner.y))
  }
  half *= 1.08
  camera.left = camera.bottom = -half
  camera.right = camera.top = half
  camera.near = 0.1
  camera.far = CAMERA_DISTANCE * 2 + 20
  camera.updateProjectionMatrix()
}

let renderer: THREE.WebGLRenderer | null = null

function renderScene(scene: THREE.Scene, target: THREE.Object3D, o: StudioOptions): HTMLCanvasElement {
  const px = o.size * RENDER_SCALE
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(1)
  }
  renderer.setSize(px, px, false)
  renderer.toneMapping = o.aces ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping
  const camera = new THREE.OrthographicCamera()
  frameCamera(camera, target, o.azimuth, o.elevation)
  // Pas de particules sur une icône : des points flous qui bavent hors du sticker
  const points: THREE.Object3D[] = []
  target.traverse((obj) => (obj as THREE.Points).isPoints && obj.visible && points.push(obj))
  points.forEach((p) => (p.visible = false))
  renderer.render(scene, camera)
  points.forEach((p) => (p.visible = true))
  const out = document.createElement('canvas')
  out.width = out.height = px
  out.getContext('2d')!.drawImage(renderer.domElement, 0, 0)
  return out
}

const makeCanvas = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h })

// Boîte englobante des pixels visibles (alpha > 8)
function alphaBounds(c: HTMLCanvasElement) {
  const { width: w, height: h } = c
  const data = c.getContext('2d')!.getImageData(0, 0, w, h).data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

function silhouette(src: HTMLCanvasElement, color: string) {
  const c = makeCanvas(src.width, src.height)
  const g = c.getContext('2d')!
  g.drawImage(src, 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = color
  g.fillRect(0, 0, c.width, c.height)
  return c
}

// Épaissit une silhouette : on la dessine décalée en cercles concentriques (plein, sans trous même sur les détails fins)
const STEPS = 36
function stamp(g: CanvasRenderingContext2D, sil: HTMLCanvasElement, radius: number, dy = 0) {
  for (const r of [radius, (radius * 2) / 3, radius / 3])
    for (let i = 0; i < STEPS; i++) {
      const a = (i / STEPS) * Math.PI * 2
      g.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r + dy)
    }
  g.drawImage(sil, 0, dy)
}

// Transforme le rendu brut en icône finie (size × size, fond transparent)
export function composeSticker(src: HTMLCanvasElement, o: StudioOptions): HTMLCanvasElement {
  const n = o.size
  const k = n / 512
  const out = makeCanvas(n, n)
  const bounds = alphaBounds(src)
  if (!bounds) return out

  const ring = (o.outline + o.border) * k
  const reserve = (o.hardShadow > 0 ? o.hardShadow * k : 0) + (o.softShadow ? 12 * k : 0) // place laissée en bas pour les ombres
  const margin = o.padding * k + ring
  const availW = n - 2 * margin
  const availH = n - 2 * margin - reserve
  const scale = Math.min(availW / bounds.w, availH / bounds.h)
  const w = bounds.w * scale
  const h = bounds.h * scale

  const obj = makeCanvas(n, n)
  const og = obj.getContext('2d')!
  og.imageSmoothingQuality = 'high'
  og.drawImage(src, bounds.x, bounds.y, bounds.w, bounds.h, (n - w) / 2, margin + (availH - h) / 2, w, h)

  // Le corps du sticker : ombre pleine, liseré, contour
  const body = makeCanvas(n, n)
  const bg = body.getContext('2d')!
  if (o.border > 0 || o.hardShadow > 0) {
    const dark = silhouette(obj, o.borderColor)
    if (o.hardShadow > 0) stamp(bg, dark, ring, o.hardShadow * k)
    if (o.border > 0) stamp(bg, dark, ring)
  }
  stamp(bg, silhouette(obj, o.outlineColor), o.outline * k)

  const g = out.getContext('2d')!
  if (o.softShadow) {
    g.shadowColor = 'rgba(10, 8, 18, 0.45)'
    g.shadowBlur = 14 * k
    g.shadowOffsetY = 8 * k
  }
  g.drawImage(body, 0, 0)
  g.shadowColor = 'transparent'
  g.drawImage(obj, 0, 0)
  return out
}

export function captureIcon(scene: THREE.Scene, target: THREE.Object3D, o: StudioOptions): HTMLCanvasElement {
  return composeSticker(renderScene(scene, target, o), o)
}

export const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('export PNG impossible'))), 'image/png'))
