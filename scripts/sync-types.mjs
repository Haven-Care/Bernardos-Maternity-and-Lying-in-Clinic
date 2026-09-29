/**
 * Copies the API contract from `frontend/src/types/` into `backend/src/contract/`.
 *
 * The frontend owns these types — they were read off the Figma and every screen
 * is built against them. The backend implements them, so it needs the same
 * definitions without the two packages depending on each other.
 *
 * One transform is applied on the way across: the frontend compiles with
 * `moduleResolution: "bundler"` and writes `from './common'`, while the backend
 * compiles with `nodenext` and needs `from './common.js'`. A verbatim copy does
 * not build.
 *
 *   node scripts/sync-types.mjs           # write
 *   node scripts/sync-types.mjs --check   # fail if stale (CI)
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'frontend/src/types')
const DEST = join(root, 'backend/src/contract')

const HEADER = `// ---------------------------------------------------------------------------
// GENERATED — do not edit.
//
// Source: frontend/src/types/. Regenerate with \`npm run sync:types\`.
// Edit the frontend copy; it is the contract, and this is a mirror of it.
// ---------------------------------------------------------------------------

`

/** \`from './common'\` -> \`from './common.js'\`, leaving already-suffixed paths alone. */
function addJsExtensions(source) {
  return source.replace(
    /(\bfrom\s+['"])(\.\.?\/[^'"]*?)(['"])/g,
    (match, open, path, close) =>
      /\.(js|json)$/.test(path) ? match : `${open}${path}.js${close}`,
  )
}

const check = process.argv.includes('--check')

const files = (await readdir(SRC)).filter((f) => f.endsWith('.ts'))
if (files.length === 0) {
  console.error(`sync-types: no .ts files found in ${SRC}`)
  process.exit(1)
}

const generated = new Map()
for (const file of files) {
  generated.set(file, HEADER + addJsExtensions(await readFile(join(SRC, file), 'utf8')))
}

if (check) {
  const stale = []

  for (const [file, want] of generated) {
    const path = join(DEST, file)
    if (!existsSync(path)) stale.push(`missing: ${file}`)
    else if ((await readFile(path, 'utf8')) !== want) stale.push(`changed: ${file}`)
  }

  // A type deleted in the frontend but still mirrored here would let the backend
  // keep compiling against a contract that no longer exists.
  if (existsSync(DEST)) {
    for (const file of await readdir(DEST)) {
      if (file.endsWith('.ts') && !generated.has(file)) stale.push(`orphaned: ${file}`)
    }
  }

  if (stale.length > 0) {
    console.error('sync-types: backend/src/contract/ is out of date.\n')
    for (const line of stale) console.error(`  ${line}`)
    console.error('\nRun `npm run sync:types` and commit the result.')
    process.exit(1)
  }

  console.log(`sync-types: up to date (${generated.size} files).`)
  process.exit(0)
}

await mkdir(DEST, { recursive: true })

for (const file of await readdir(DEST).catch(() => [])) {
  if (file.endsWith('.ts') && !generated.has(file)) await rm(join(DEST, file))
}

for (const [file, contents] of generated) {
  await writeFile(join(DEST, file), contents)
}

console.log(`sync-types: wrote ${generated.size} files to backend/src/contract/.`)
