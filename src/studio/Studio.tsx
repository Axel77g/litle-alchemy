import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { world1 } from '../content/world1'
import type { ItemDef } from '../engine/items'
import { OBJECTS } from '../scene/objects'
import { PROPS } from '../scene/props'
import { DEFAULT_OPTIONS, captureIcon, frameCamera, toBlob, type StudioOptions } from './capture'
import { zip } from './zip'

// Studio de capture : ouvre /?studio. Photographie chaque item en 3D (fond transparent) pour en faire l'icône de sa carte.
// Réglages à gauche/droite, résultat final au centre ; « Tout exporter » produit un zip de PNG nommés <id>.png.

const ITEMS = Object.values(world1.rules.items)
const KIND_LABEL = { material: 'Matières', catalyst: 'Catalyseurs', producer: 'Producteurs' } as const
const STORAGE_KEY = 'studio:options'

// Producteur : son modèle de l'île. Matière / catalyseur : le modèle dédié de props.tsx
const modelOf = (def: ItemDef): ComponentType | undefined => (def.kind === 'producer' ? OBJECTS[def.model!] : PROPS[def.id])

function loadOptions(): StudioOptions {
  try {
    return { ...DEFAULT_OPTIONS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return DEFAULT_OPTIONS
  }
}

interface Stage {
  scene: THREE.Scene
  target: THREE.Object3D
}

const rad = THREE.MathUtils.degToRad
const around = (az: number, el: number, d = 10): [number, number, number] => [Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d]

// Lumières accrochées à la caméra : même rendu quel que soit l'angle choisi
function Lights({ o }: { o: StudioOptions }) {
  const a = rad(o.azimuth)
  return (
    <>
      <hemisphereLight args={['#ffffff', '#9a8aa8', 0.9 * o.light]} />
      <directionalLight position={around(a - 0.8, 0.95)} intensity={1.6 * o.light} color="#fff4e0" />
      <directionalLight position={around(a + 1.3, 0.35)} intensity={0.55 * o.light} color="#c4d4ff" />
      <directionalLight position={around(a + Math.PI, 0.6)} intensity={0.35 * o.light} color="#ffffff" />
    </>
  )
}

// Contenu de la scène 3D : lumières + le modèle de l'item, et l'aperçu live (caméra cadrée comme la capture)
function StageScene({ def, o, stage }: { def: ItemDef; o: StudioOptions; stage: React.RefObject<Stage | null> }) {
  const group = useRef<THREE.Group>(null)
  const { scene, camera, gl } = useThree()
  const Model = modelOf(def)

  useEffect(() => {
    gl.toneMapping = o.aces ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping
    gl.setClearColor(0x000000, 0)
    ;(camera as THREE.OrthographicCamera & { manual: boolean }).manual = true // R3F ne doit pas redimensionner le cadrage à notre place
  }, [gl, camera, o.aces])

  useEffect(() => {
    stage.current = { scene, target: group.current! }
    group.current!.userData.itemId = def.id
    const t = setTimeout(() => frameCamera(camera as THREE.OrthographicCamera, group.current!, o.azimuth, o.elevation), 60)
    return () => clearTimeout(t)
  }, [scene, camera, stage, def.id, o.azimuth, o.elevation])

  return (
    <>
      <Lights o={o} />
      <group ref={group}>{Model && <Model key={def.id} />}</group>
    </>
  )
}

const frames = (n: number) => new Promise<void>((resolve) => (function tick(i: number) { i ? requestAnimationFrame(() => tick(i - 1)) : resolve() })(n))

function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const BACKGROUNDS = {
  damier: 'repeating-conic-gradient(#3b364a 0% 25%, #2c273a 0% 50%) 0 0 / 24px 24px',
  nuit: '#151122',
  crème: 'linear-gradient(#fff7e6, #ffe2b0)',
  vert: 'linear-gradient(#f1fff8, #aef2d6)',
} as const

function Slider({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between font-display text-[12px] font-extrabold text-on-surface-variant">
        {label}
        <span className="text-tertiary">
          {value}
          {unit}
        </span>
      </span>
      <input type="range" className="w-full accent-primary" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  )
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-2 rounded-2xl bg-surface-container p-3">
    <h3 className="font-display text-[13px] font-black uppercase tracking-wide text-primary">{title}</h3>
    {children}
  </section>
)

export default function Studio() {
  const [id, setId] = useState(ITEMS[0].id)
  const [o, setO] = useState<StudioOptions>(loadOptions)
  const [bg, setBg] = useState<keyof typeof BACKGROUNDS>('damier')
  const [preview, setPreview] = useState<string>()
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const stage = useRef<Stage | null>(null)
  const def = world1.rules.items[id]
  const set = <K extends keyof StudioOptions>(k: K, v: StudioOptions[K]) => setO((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(o))
    } catch {}
  }, [o])

  // Attend que le modèle de l'item demandé soit monté dans la scène 3D, puis le photographie
  const shoot = useCallback(async (itemId: string) => {
    for (let i = 0; i < 60 && !(stage.current?.target.userData.itemId === itemId && stage.current.target.children.length); i++) await frames(1)
    await frames(2)
    if (!stage.current) throw new Error('scène 3D pas prête')
    return captureIcon(stage.current.scene, stage.current.target, o)
  }, [o])

  // Aperçu du résultat final, recalculé à chaque changement d'item ou de réglage
  useEffect(() => {
    if (busy) return
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const canvas = await shoot(id)
        if (!cancelled) setPreview(canvas.toDataURL('image/png'))
      } catch (e) {
        if (!cancelled) setStatus(String(e))
      }
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [id, shoot, busy])

  const exportOne = async () => download(await toBlob(await shoot(id)), `${id}.png`)

  async function exportAll() {
    setBusy(true)
    const files: { name: string; data: Uint8Array }[] = []
    const skipped: string[] = []
    try {
      for (const [i, item] of ITEMS.entries()) {
        setStatus(`Capture ${i + 1}/${ITEMS.length} : ${item.name}`)
        if (!modelOf(item)) {
          skipped.push(item.id)
          continue
        }
        setId(item.id)
        const blob = await toBlob(await shoot(item.id))
        files.push({ name: `${item.id}.png`, data: new Uint8Array(await blob.arrayBuffer()) })
      }
      download(zip(files), `icones-${world1.id}-${o.size}.zip`)
      setStatus(`${files.length} icônes exportées${skipped.length ? ` · sans modèle 3D : ${skipped.join(', ')}` : ''}`)
    } catch (e) {
      setStatus(`Échec : ${e}`)
    } finally {
      setBusy(false)
    }
  }

  const missing = !modelOf(def)

  return (
    <div className="flex h-full text-on-surface">
      {/* Liste des items */}
      <aside className="w-60 shrink-0 space-y-4 overflow-y-auto bg-surface-container-low p-3">
        <h1 className="font-display text-[18px] font-black text-tertiary">📸 Studio d'icônes</h1>
        {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((kind) => (
          <div key={kind}>
            <h2 className="mb-1 font-display text-[11px] font-black uppercase tracking-wide text-on-surface-variant">{KIND_LABEL[kind]}</h2>
            <ul className="space-y-1">
              {ITEMS.filter((d) => d.kind === kind).map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => setId(d.id)}
                    className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left font-display text-[13px] font-extrabold ${d.id === id ? 'bg-primary-container text-on-primary' : 'bg-surface-container hover:bg-surface-container-high'}`}
                  >
                    <span className="text-[18px]">{d.icon}</span>
                    <span className="flex-1 truncate">{d.name}</span>
                    {!modelOf(d) && <span title="Pas de modèle 3D">⚠️</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </aside>

      {/* Résultat */}
      <main className="flex min-w-0 flex-1 flex-col items-center gap-3 p-4">
        <div className="flex gap-2">
          {(Object.keys(BACKGROUNDS) as (keyof typeof BACKGROUNDS)[]).map((b) => (
            <button key={b} onClick={() => setBg(b)} className={`rounded-full px-3 py-1 font-display text-[12px] font-extrabold ${b === bg ? 'bg-tertiary text-on-tertiary' : 'bg-surface-container-high'}`}>
              {b}
            </button>
          ))}
        </div>
        <div className="grid min-h-0 w-full max-w-[640px] flex-1 place-items-center rounded-3xl p-4" style={{ background: BACKGROUNDS[bg] }}>
          {missing ? (
            <p className="font-display font-black text-secondary">Pas de modèle 3D pour « {def.name} » : ajoute-le dans scene/props.tsx</p>
          ) : (
            preview && <img src={preview} alt={def.name} className="max-h-full max-w-full object-contain" style={{ imageRendering: 'auto' }} />
          )}
        </div>
        <p className="h-5 font-display text-[13px] font-bold text-on-surface-variant">{status}</p>
        <div className="flex gap-2">
          <button disabled={busy || missing} onClick={exportOne} className="rounded-xl bg-primary-container px-4 py-2 font-display text-[14px] font-black text-on-primary shadow-chunk disabled:opacity-40">
            ⬇ PNG « {def.name} »
          </button>
          <button disabled={busy} onClick={exportAll} className="rounded-xl bg-secondary-container px-4 py-2 font-display text-[14px] font-black text-surface-container-lowest shadow-chunk disabled:opacity-40">
            📦 Tout exporter (zip)
          </button>
        </div>
      </main>

      {/* Réglages */}
      <aside className="w-72 shrink-0 space-y-3 overflow-y-auto bg-surface-container-low p-3">
        {/* Aperçu 3D live : la scène réelle (animations comprises), qui sert aussi de source à la capture */}
        <div className="mx-auto size-[140px] overflow-hidden rounded-2xl" style={{ background: BACKGROUNDS.damier }}>
          <Canvas orthographic camera={{ position: [10, 10, 10] }} gl={{ alpha: true, antialias: true }} dpr={[1, 2]}>
            <StageScene def={def} o={o} stage={stage} />
          </Canvas>
        </div>

        <Section title="Image">
          <label className="flex items-center justify-between font-display text-[12px] font-extrabold text-on-surface-variant">
            Taille
            <select value={o.size} onChange={(e) => set('size', +e.target.value)} className="rounded-lg bg-surface-container-high px-2 py-1 text-on-surface">
              {[128, 256, 512, 1024].map((s) => (
                <option key={s} value={s}>
                  {s} × {s}
                </option>
              ))}
            </select>
          </label>
          <Slider label="Marge" value={o.padding} min={0} max={60} unit="px" onChange={(v) => set('padding', v)} />
        </Section>

        <Section title="Vue">
          <Slider label="Rotation" value={o.azimuth} min={0} max={360} unit="°" onChange={(v) => set('azimuth', v)} />
          <Slider label="Hauteur de caméra" value={o.elevation} min={5} max={85} step={0.5} unit="°" onChange={(v) => set('elevation', v)} />
          <Slider label="Lumière" value={o.light} min={0.3} max={2.5} step={0.05} unit="×" onChange={(v) => set('light', v)} />
          <label className="flex items-center gap-2 font-display text-[12px] font-extrabold text-on-surface-variant">
            <input type="checkbox" checked={o.aces} onChange={(e) => set('aces', e.target.checked)} className="accent-primary" />
            Tone mapping du jeu (ACES, couleurs plus ternes)
          </label>
          <button onClick={() => setO((p) => ({ ...p, azimuth: DEFAULT_OPTIONS.azimuth, elevation: DEFAULT_OPTIONS.elevation }))} className="text-[12px] font-bold text-primary underline">
            Angle du jeu
          </button>
        </Section>

        <Section title="Sticker">
          <Slider label="Contour" value={o.outline} min={0} max={40} unit="px" onChange={(v) => set('outline', v)} />
          <label className="flex items-center justify-between font-display text-[12px] font-extrabold text-on-surface-variant">
            Couleur du contour
            <input type="color" value={o.outlineColor} onChange={(e) => set('outlineColor', e.target.value)} />
          </label>
          <Slider label="Liseré sombre" value={o.border} min={0} max={20} unit="px" onChange={(v) => set('border', v)} />
          <label className="flex items-center justify-between font-display text-[12px] font-extrabold text-on-surface-variant">
            Couleur du liseré
            <input type="color" value={o.borderColor} onChange={(e) => set('borderColor', e.target.value)} />
          </label>
          <Slider label="Ombre pleine" value={o.hardShadow} min={0} max={30} unit="px" onChange={(v) => set('hardShadow', v)} />
          <label className="flex items-center gap-2 font-display text-[12px] font-extrabold text-on-surface-variant">
            <input type="checkbox" checked={o.softShadow} onChange={(e) => set('softShadow', e.target.checked)} className="accent-primary" />
            Ombre douce
          </label>
          <p className="text-[11px] font-semibold text-on-surface-variant">Les px sont donnés pour une image de 512 et suivent la taille choisie.</p>
        </Section>
      </aside>
    </div>
  )
}
