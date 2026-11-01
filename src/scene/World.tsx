import { useMemo, useRef } from 'react'
import { useFrame } from '../debug/livePerf'
import * as THREE from 'three'
import { OBJECTS } from './objects'
import { ANIMATED_MODELS, PoseContext, type PoseState } from './Caveman'
import { windTime } from './wind'
import { hash01 } from './noise'
import { smoothHour } from './smoothHour'
import { DROP_HEIGHT, DROP_TIME, POP_DURATION, dropStart, popStart, pruneImpacts, triggerImpact } from '../fx/effects'
import { homeProgress } from '../engine/clock'
import { useUi } from '../ui/uiStore'
import { TILE } from './constants'
import GlowDisc from './GlowDisc'
import Ground, { tileHeight, tileLift } from './Ground'
import { useGame } from '../store/game'
import type { GridCell, PlacedEntity, World as WorldMap } from '../engine/types'

// Vitesse (cases / s) à laquelle le cycle de marche du modèle ne glisse pas sur le sol : l'animation de marche est accélérée / ralentie pour la suivre. À régler à l'œil.
const WALK_SPEED = 0.8

// Orientation de repos des modèles animés (personnages, animaux) : ils regardent le feu de camp le plus proche s'il est à moins de FIRE_LOOK_RADIUS cases,
// sinon une direction au hasard (fixe pour un même id : elle ne change pas d'une image à l'autre). Variété : ils ne sont plus tous alignés dans le même sens.
const FIRE_MODEL = 'campfire'
const FIRE_LOOK_RADIUS = 3.5

// Objets fixes à qui l'on donne une orientation au hasard à la pose (fixe pour un même id), pour qu'ils ne soient pas tous alignés
const RANDOM_SPIN = new Set(['rock', 'campfire', 'puddle', 'hut', 'tribal_hut'])

export const WAVE_RADIUS = 3 // rayon (en cases) de l'onde créée par la pose d'un objet

// Objet qui tombe du ciel à sa pose, puis déclenche une onde dans le sol en touchant terre.
// Les objets de départ (jamais enregistrés par les FX) apparaissent directement.
function DropIn({ cell, children }: { cell: GridCell; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!)
  const landed = useRef(false)
  const entityId = cell.entity!.id

  useFrame('World.drop', () => {
    const placedAt = dropStart(entityId)
    if (placedAt === undefined || (landed.current && ref.current.scale.y === 1)) return
    const t = (performance.now() - placedAt) / 1000
    ref.current.visible = t >= 0 // caché tant que sa case n'a pas atterri
    if (t < 0) {
      ref.current.position.y = DROP_HEIGHT
      return
    }
    if (t < DROP_TIME) {
      // chute accélérée : y = H * (1 - (t/T)²)
      ref.current.position.y = DROP_HEIGHT * (1 - (t / DROP_TIME) ** 2)
      return
    }
    if (!landed.current) {
      landed.current = true
      triggerImpact(cell.x, cell.z, WAVE_RADIUS)
    }
    // petit écrasement amorti à l'atterrissage
    const dt = t - DROP_TIME
    ref.current.position.y = 0
    ref.current.scale.y = dt > 0.6 ? 1 : 1 - Math.exp(-9 * dt) * Math.sin(dt * 28) * 0.18
    ref.current.scale.x = ref.current.scale.z = 2 - ref.current.scale.y
  })

  const placedAt = dropStart(entityId)
  return (
    <group
      ref={ref}
      position-y={placedAt !== undefined && performance.now() - placedAt < DROP_TIME * 1000 ? DROP_HEIGHT : 0}
    >
      {children}
    </group>
  )
}

// Tout ce qui anime un producteur déjà posé : frénésie (grossit, pulse, se trémousse), pop de production,
// retour à la maison la nuit (les personnages marchent vers leur cabane, ou s'endorment sur place) et retrait pendant un glisser.
// Les compteurs du moteur changent sans re-rendu : on les lit à chaque image.
function Alive({ entity, x, z, home, look, worker, still, animated, children }: { entity: PlacedEntity; x: number; z: number; home?: { dx: number; dz: number }; look: number; worker: boolean; still: boolean; animated: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!)
  // Pose lue par les modèles animés (Caveman.tsx) : loot le jour, walk en rentrant, sleep quand il s'endort dehors
  const seed = useMemo(() => hash01(entity.id), [entity.id])
  // Décalage (en heures de jeu) du départ du soir et du retour du matin : chacun a ses horaires, ils ne partent pas tous d'un coup
  const shift = useMemo(() => ({ evening: (hash01(entity.id, 1) - 0.5) * 2.2, morning: (hash01(entity.id, 2) - 0.5) * 2.2 }), [entity.id])
  const pose = useRef<PoseState>({ pose: 'loot', speed: 1, seed, hidden: false })
  const lastPos = useRef<{ x: number; z: number } | null>(null) // position à l'image précédente (vitesse réelle de marche)
  const walkSpeed = useRef(0) // vitesse lissée
  const facing = useRef(look) // orientation actuelle (part directement de l'angle de repos : pas de pivotement à l'apparition) : tourne progressivement vers la cible au lieu de claquer
  useFrame('World.wander', ({ clock }, delta) => {
    const g = ref.current
    let sx = 1
    let sy = 1
    let rz = 0
    let ry = look // au repos : vers le feu proche, ou direction aléatoire
    let px = 0
    let py = 0
    let pz = 0

    if (entity.frenzyTimer > 0) {
      const t = clock.elapsedTime
      const fade = Math.min(1, entity.frenzyTimer) // s'estompe dans la dernière seconde
      sx = sy = 1 + (0.16 + Math.sin(t * 16) * 0.06) * fade
      rz = Math.sin(t * 22) * 0.12 * fade
    }

    // Pop de production (pas pour les modèles animés) : étirement vertical rapide puis retour, avec un petit rebond
    const popAt = still || animated ? undefined : popStart(entity.id) // les modèles animés ne s'étirent pas : ils jouent leur animation
    if (popAt !== undefined) {
      const k = (performance.now() - popAt) / 1000 / POP_DURATION
      if (k < 1) {
        const s = Math.sin(Math.PI * k) * (1 - k * 0.4)
        sy *= 1 + 0.38 * s
        sx *= 1 - 0.16 * s
      }
    }

    // Nuit : les personnages rentrent chez eux (cabane la plus proche : ils y marchent et disparaissent), sinon ils s'endorment
    const hour = smoothHour()
    const hp = worker ? homeProgress(hour + (hour % 24 < 12 ? shift.morning : shift.evening)) : 0
    pose.current.pose = 'loot'
    pose.current.speed = entity.frenzyTimer > 0 ? 2 : 1
    if (hp > 0) {
      if (home) {
        px = home.dx * TILE * hp
        pz = home.dz * TILE * hp
        if (hp < 1) {
          if (!animated) py = Math.abs(Math.sin(clock.elapsedTime * 14)) * 0.07 // petits pas
          // le soir il regarde vers la cabane, le matin (il en sort) dans l'autre sens
          ry = Math.atan2(home.dx, home.dz) + (hour % 24 < 12 ? Math.PI : 0)
          pose.current.pose = 'walk'
        }
        const hide = THREE.MathUtils.smoothstep(hp, 0.88, 1)
        sx *= 1 - hide
        sy *= 1 - hide
      } else if (animated) {
        pose.current.pose = 'sleep' // le modèle se couche lui-même
      } else {
        rz += (Math.PI / 2) * hp
        py = 0.12 * hp
      }
    }

    // Pris en main pour être déplacé : on le réduit sur sa case d'origine
    const drag = useUi.getState().drag
    if (drag?.from && drag.from.x === x && drag.from.z === z) {
      sx *= 0.45
      sy *= 0.45
    }

    g.visible = sx > 0.02
    pose.current.seed = seed
    pose.current.hidden = !g.visible
    g.scale.set(Math.max(sx, 0.001), Math.max(sy, 0.001), Math.max(sx, 0.001))
    g.position.set(px, py, pz)
    // La marche suit le déplacement réel (qui accélère puis ralentit) : sinon les pieds patinent au départ et à l'arrivée
    const last = lastPos.current
    if (last && delta > 0) walkSpeed.current += (Math.hypot(px - last.x, pz - last.z) / delta - walkSpeed.current) * Math.min(1, delta * 12)
    lastPos.current = { x: px, z: pz }
    if (pose.current.pose === 'walk') pose.current.speed = THREE.MathUtils.clamp(walkSpeed.current / WALK_SPEED, 0.35, 2.5)
    const turn = Math.atan2(Math.sin(ry - facing.current), Math.cos(ry - facing.current)) // plus court chemin, dans ]-π, π]
    facing.current += turn * Math.min(1, delta * 10)
    g.rotation.set(0, facing.current, rz)
  })
  return (
    <group ref={ref}>
      {worker && <GlowDisc />}
      <PoseContext.Provider value={pose}>{children}</PoseContext.Provider>
    </group>
  )
}

// Ce qui est posé sur une case (le sol lui-même est instancié : voir Ground.tsx). Le groupe suit la hauteur de la case
// (onde, chute) via la même fonction que le sol ; « un peu enfoncé » dans l'herbe pour que l'ombre colle au pied.
function Tile({ cell, home, look }: { cell: GridCell; home?: { dx: number; dz: number }; look: number }) {
  const { x, z, entity } = cell
  const rules = useGame((s) => s.rules)
  const model = entity && rules.items[entity.itemId]?.model
  const Object3D = model ? OBJECTS[model] : undefined

  const ref = useRef<THREE.Group>(null!)
  useFrame('World.follow', () => {
    const y = tileHeight(x, z) - 0.03
    if (ref.current.position.y !== y) ref.current.position.y = y
  })

  return (
    <group ref={ref} position={[x * TILE, tileLift(x, z) - 0.03, z * TILE]}>
      {entity && Object3D && (
        <DropIn key={entity.id} cell={cell}>
          <Alive entity={entity} x={x} z={z} home={home} look={look} worker={rules.items[entity.itemId]?.nightMultiplier !== undefined} still={!!rules.items[entity.itemId]?.noPop} animated={!!model && ANIMATED_MODELS.has(model)}>
            <Object3D />
          </Alive>
        </DropIn>
      )}
    </group>
  )
}

// `world` : Map "x,z" -> cellule (voir engine/grid.ts)
export default function World({ world }: { world: WorldMap }) {
  useFrame('World.prune', ({ clock }) => {
    pruneImpacts()
    windTime.value = clock.elapsedTime // le vent des arbres avance
  })
  const rules = useGame((s) => s.rules)
  // Pour chaque personnage : la cabane la plus proche où il rentre la nuit (décalage en cases), s'il y en a une
  const homes = useMemo(() => {
    const cells = [...world.values()]
    const houses = cells.filter((c) => c.entity && rules.items[c.entity.itemId]?.tags?.includes('home'))
    const map = new Map<string, { dx: number; dz: number }>()
    if (!houses.length) return map
    for (const c of cells) {
      if (!c.entity || rules.items[c.entity.itemId]?.nightMultiplier === undefined) continue
      let best = houses[0]
      for (const h of houses) if (Math.hypot(h.x - c.x, h.z - c.z) < Math.hypot(best.x - c.x, best.z - c.z)) best = h
      map.set(c.entity.id, { dx: best.x - c.x, dz: best.z - c.z })
    }
    return map
  }, [world, rules])
  // Pour chaque modèle animé (ou à orientation aléatoire) : l'angle (autour de y) où il regarde au repos
  const looks = useMemo(() => {
    const cells = [...world.values()]
    const fires = cells.filter((c) => c.entity && rules.items[c.entity.itemId]?.model === FIRE_MODEL)
    const map = new Map<string, number>()
    for (const c of cells) {
      const e = c.entity
      const model = e && rules.items[e.itemId]?.model
      if (!e || !model) continue
      if (!ANIMATED_MODELS.has(model)) {
        if (RANDOM_SPIN.has(model)) map.set(e.id, hash01(e.id, 3) * Math.PI * 2)
        continue
      }
      let best: GridCell | undefined
      let bestDist = FIRE_LOOK_RADIUS
      for (const f of fires) {
        const d = Math.hypot(f.x - c.x, f.z - c.z)
        if (d <= bestDist) {
          best = f
          bestDist = d
        }
      }
      map.set(e.id, best ? Math.atan2(best.x - c.x, best.z - c.z) : hash01(e.id, 3) * Math.PI * 2)
    }
    return map
  }, [world, rules])
  return (
    <group>
      <Ground world={world} />
      {[...world.values()].map((cell) => cell.terrain !== 'VOID' && cell.entity && <Tile key={`${cell.x},${cell.z}`} cell={cell} home={cell.entity ? homes.get(cell.entity.id) : undefined} look={cell.entity ? (looks.get(cell.entity.id) ?? 0) : 0} />)}
    </group>
  )
}
