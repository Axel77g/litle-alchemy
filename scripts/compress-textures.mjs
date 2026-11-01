// Compresse les textures de tous les .glb de public/models : 512px max, WebP. Usage : npm run models:compress [-- fichier.glb ...]
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { textureCompress } from '@gltf-transform/functions'
import sharp from 'sharp'

const DIR = resolve('public/models')
const SIZE = 512

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

const args = process.argv.slice(2)
const files = args.length ? args : (await readdir(DIR)).filter((f) => f.endsWith('.glb'))

const kb = (n) => `${(n / 1024).toFixed(0)} Ko`
let before = 0
let after = 0

for (const file of files) {
  const path = file.includes('/') ? resolve(file) : join(DIR, file)
  const input = await readFile(path)
  const doc = await io.readBinary(new Uint8Array(input))
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [SIZE, SIZE], quality: 85 }))
  const output = Buffer.from(await io.writeBinary(doc))
  // On n'écrase que si c'est plus léger : relancer le script sur un modèle déjà compressé ne le dégrade pas.
  if (output.length < input.length) await writeFile(path, output)
  const kept = Math.min(output.length, input.length)
  before += input.length
  after += kept
  console.log(`${file}: ${kb(input.length)} -> ${kb(kept)}`)
}
console.log(`Total: ${kb(before)} -> ${kb(after)}`)
