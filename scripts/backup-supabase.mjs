import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const requireBackend = createRequire(resolve(projectRoot, 'backend/package.json'))
const { createClient } = requireBackend('@supabase/supabase-js')
const dotenv = requireBackend('dotenv')

export async function projectClient() {
  const configured = dotenv.parse(await readFile(resolve(projectRoot, 'backend/.env')))
  const url = process.env.SUPABASE_URL || configured.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || configured.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('The backend Supabase URL and service-role key are required.')
  return { url, client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) }
}

export async function allAuthUsers(client) {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw new Error(`Auth export failed: ${error.message}`)
    users.push(...data.users)
    if (data.users.length < 100) break
  }
  return users
}

export async function publicTableNames() {
  const types = await readFile(resolve(projectRoot, 'backend/src/db/types.ts'), 'utf8')
  return [...types.split('    Tables: {')[1].split('    Views: {')[0].matchAll(/^      ([a-z_]+): \{$/gm)].map(match => match[1])
}

async function tableRows(client, table) {
  const primaryKey = { notification_prefs: 'profile_id', operating_hours: 'key', medicine_photos: 'medicine_id' }[table] || 'id'
  const rows = []
  let expected
  for (let offset = 0; ; offset += 500) {
    const { data, count, error } = await client.from(table).select('*', { count: 'exact' })
      .order(primaryKey).range(offset, offset + 499)
    if (error) throw new Error(`Export ${table}: ${error.message}`)
    expected ??= count
    rows.push(...data)
    if (data.length < 500) break
  }
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true })
  if (error || count !== expected || rows.length !== count) throw new Error(`Table ${table} changed during export; retry the backup.`)
  return rows
}

export async function verifyBackup(directory) {
  const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'))
  if (!manifest.complete) throw new Error('Backup is incomplete.')
  for (const entry of manifest.files) {
    const bytes = await readFile(resolve(directory, entry.path))
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Backup checksum failed: ${entry.path}`)
  }
  return manifest
}

export async function backupProject(directory) {
  const { url, client } = await projectClient()
  const hostname = new URL(url).hostname
  const output = resolve(directory)
  try {
    const previous = JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8'))
    if (previous.complete) throw new Error('Refusing to overwrite a completed backup; choose a new directory.')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await mkdir(output, { recursive: true, mode: 0o700 })
  const manifest = {
    format: 'havencare-logical-data-backup-v1', projectHost: hostname,
    startedAt: new Date().toISOString(), complete: false, tables: {}, authUsers: 0,
    storageObjects: 0, storageBytes: 0, files: [],
    limitations: ['API export is paginated, not an atomic PostgreSQL snapshot.',
      'Auth password hashes, sessions, and refresh tokens are intentionally excluded.',
      'Schema reference files are repository migrations, not a pg_dump of hosted database roles or settings.'],
  }
  async function save(name, value, binary = false) {
    const target = resolve(output, name)
    if (!target.startsWith(output + sep)) throw new Error('Unsafe backup object path.')
    await mkdir(dirname(target), { recursive: true, mode: 0o700 })
    const bytes = binary ? Buffer.from(value) : Buffer.from(JSON.stringify(value, null, 2) + '\n')
    await writeFile(target, bytes, { mode: 0o600 })
    manifest.files.push({ path: relative(output, target), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 })
  for (const table of await publicTableNames()) {
    const rows = await tableRows(client, table)
    await save(`public/${table}.json`, rows)
    manifest.tables[table] = rows.length
    console.log(`Exported ${table}: ${rows.length} rows`)
  }
  const users = await allAuthUsers(client)
  await save('auth/users-admin-api.json', users)
  manifest.authUsers = users.length
  const { data: buckets, error: bucketsError } = await client.storage.listBuckets()
  if (bucketsError) throw new Error(`Storage buckets: ${bucketsError.message}`)
  await save('storage/buckets.json', buckets)
  const objects = []
  for (const bucket of buckets) {
    const folders = ['']
    for (const prefix of folders) {
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await client.storage.from(bucket.id).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })
        if (error) throw new Error(`Storage list ${bucket.id}: ${error.message}`)
        for (const object of data) {
          const name = prefix ? `${prefix}/${object.name}` : object.name
          if (!object.id) { folders.push(name); continue }
          const { data: content, error: downloadError } = await client.storage.from(bucket.id).download(name)
          if (downloadError) throw new Error(`Storage download ${bucket.id}/${name}: ${downloadError.message}`)
          const bytes = Buffer.from(await content.arrayBuffer())
          const filename = `storage/files/${bucket.id}/${name}`
          await save(filename, bytes, true)
          objects.push({ bucket: bucket.id, name, metadata: object, file: filename })
          manifest.storageObjects++
          manifest.storageBytes += bytes.length
        }
        if (data.length < 100) break
      }
    }
  }
  await save('storage/objects.json', objects)
  const { readdir } = await import('node:fs/promises')
  for (const filename of (await readdir(resolve(projectRoot, 'supabase/migrations'))).filter(name => name.endsWith('.sql'))) {
    await save(`schema-reference/migrations/${filename}`, await readFile(resolve(projectRoot, 'supabase/migrations', filename)), true)
  }
  await save('schema-reference/config.toml', await readFile(resolve(projectRoot, 'supabase/config.toml')), true)
  await save('schema-reference/types.ts', await readFile(resolve(projectRoot, 'backend/src/db/types.ts')), true)
  // Keep an additional SQL seed reference without invoking its destructive TRUNCATE.
  const originalSeed = await readFile(resolve(projectRoot, 'supabase/seed.sql'))
  await save('schema-reference/original-seed.sql', originalSeed, true)
  manifest.complete = true
  manifest.completedAt = new Date().toISOString()
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
  await verifyBackup(output)
  console.log(JSON.stringify({ backup: output, tables: Object.keys(manifest.tables).length, authUsers: users.length,
    storageObjects: manifest.storageObjects, storageBytes: manifest.storageBytes, checksumVerified: true }))
  return manifest
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[2]
  if (!output) throw new Error('Usage: node scripts/backup-supabase.mjs PRIVATE_OUTPUT_DIRECTORY')
  backupProject(output).catch(error => { console.error(error.message); process.exitCode = 1 })
}
