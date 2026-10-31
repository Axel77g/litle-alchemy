// Mesure de performance : island.perf() dans la console.
import { Vector2, type WebGLRenderer } from 'three'

let renderer: WebGLRenderer | null = null
export const registerRenderer = (gl: WebGLRenderer) => void (renderer = gl)

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r))

export async function measurePerf(seconds = 3) {
  if (!renderer) throw new Error('renderer pas prêt')
  const gl = renderer

  // fps réels sur `seconds` secondes
  let frames = 0
  const start = await nextFrame()
  let now = start
  while (now - start < seconds * 1000) {
    now = await nextFrame()
    frames++
  }
  const fps = (frames / (now - start)) * 1000

  // travail du GPU pour UNE image (le composer fait plusieurs rendus : on désactive la remise à zéro automatique)
  gl.info.autoReset = false
  gl.info.reset()
  await nextFrame()
  await nextFrame()
  const { calls, triangles } = gl.info.render
  gl.info.autoReset = true

  const size = gl.getDrawingBufferSize(new Vector2())
  return {
    fps: Math.round(fps * 10) / 10,
    pixelRatio: gl.getPixelRatio(),
    buffer: `${size.x}×${size.y} (${((size.x * size.y) / 1e6).toFixed(2)} Mpx)`,
    'draw calls / image': Math.round(calls / 2),
    'triangles / image': Math.round(triangles / 2),
    geometries: gl.info.memory.geometries,
    textures: gl.info.memory.textures,
  }
}
