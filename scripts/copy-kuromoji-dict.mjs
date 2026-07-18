// Copies kuromoji's IPADIC dictionary files into public/dict/kuromoji so
// they're served as static assets in the browser build (see
// src/utils/kanaGenerator.ts). Not committed to git (see .gitignore) - this
// keeps the ~15MB of binary dictionary data out of the repo and re-syncs it
// on every `npm install` instead, including on Vercel's build.
import { readdirSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const srcDir = path.join(rootDir, 'node_modules', 'kuromoji', 'dict')
const destDir = path.join(rootDir, 'public', 'dict', 'kuromoji')

if (!existsSync(srcDir)) {
  console.warn(`[copy-kuromoji-dict] source dir not found, skipping: ${srcDir}`)
  process.exit(0)
}

mkdirSync(destDir, { recursive: true })
for (const file of readdirSync(srcDir)) {
  if (!file.endsWith('.dat.gz')) continue
  copyFileSync(path.join(srcDir, file), path.join(destDir, file))
}
console.log(`[copy-kuromoji-dict] copied dictionary to ${destDir}`)
