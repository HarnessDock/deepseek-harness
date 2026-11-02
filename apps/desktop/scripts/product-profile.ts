/**
 * Render product/profile.yml with the deployment's service addresses (product.json `profileEnv`, LPM-NEXT/.env; public
 * LPM_PUBLIC_* values win, as in LPM-NEXT apps/desktop/scripts/prepare.mjs) and the bundled logo.
 *   tsx scripts/product-profile.ts --out <file>        write the rendered profile (packaging)
 *   tsx scripts/product-profile.ts --apply <profile>   merge it into a profile's cordis.patch.yml (development desktop)
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs, parseEnv } from 'node:util'
import { pathToFileURL } from 'node:url'
import { mergeProductEntries, productEntries } from '../src/product-profile.ts'

const APP_ROOT = resolve(import.meta.dirname, '..')
const REPOSITORY_ROOT = resolve(APP_ROOT, '..', '..')
const PRODUCT = JSON.parse(readFileSync(join(APP_ROOT, 'product.json'), 'utf8')) as { profileEnv?: string }

/** @returns the rendered product profile text. */
export function renderProductProfile(): string {
  const envFile = process.env.PRODUCT_ENV ?? (PRODUCT.profileEnv ? resolve(REPOSITORY_ROOT, PRODUCT.profileEnv) : undefined)
  let fileEnv: Record<string, string | undefined> = {}
  try { if (envFile) fileEnv = parseEnv(readFileSync(envFile, 'utf8')) } catch { console.warn(`product profile: ${envFile} not found, using the process environment only`) }
  // The process environment wins over the file, as with dotenv
  const env: Record<string, string | undefined> = { ...fileEnv, ...process.env }
  const values: Record<string, string | undefined> = {
    resolver: env.LPM_PUBLIC_RESOLVER_URL ?? env.RESOLVER_PUBLIC_URL ?? `http://127.0.0.1:${env.RESOLVER_PORT ?? 7102}`,
    authz: env.LPM_PUBLIC_AUTHZ_URL ?? env.AUTHZ_URL ?? `http://127.0.0.1:${env.AUTHZ_PORT ?? 7101}`,
    casdoor: env.CASDOOR_ENDPOINT,
    clientId: env.LPM_DESKTOP_CLIENT_ID ?? env.CASDOOR_CLIENT_ID,
    web: env.LPM_PUBLIC_WEB_URL ?? env.LPM_WEB_URL ?? 'http://localhost:5173',
    logo: `data:image/svg+xml;base64,${readFileSync(join(APP_ROOT, 'product', 'logo.svg')).toString('base64')}`,
  }
  if (!values.casdoor || !values.clientId) throw new Error('product profile: CASDOOR_ENDPOINT and CASDOOR_CLIENT_ID are required for sign-in')
  return readFileSync(join(APP_ROOT, 'product', 'profile.yml'), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (values[key] === undefined) throw new Error(`product profile: unknown placeholder ${key}`)
    return values[key].replace(/'/g, "''")
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { values } = parseArgs({ options: { out: { type: 'string' }, apply: { type: 'string' } } })
  const text = renderProductProfile()
  if (values.out) writeFileSync(values.out, text)
  if (values.apply) {
    const patchPath = join(values.apply, 'cordis.patch.yml')
    let before = '[]\n'
    try { before = readFileSync(patchPath, 'utf8') } catch { /* new profile */ }
    writeFileSync(patchPath, mergeProductEntries(before, productEntries(text)), { mode: 0o600 })
    console.log(`product profile → ${patchPath}`)
  }
  if (!values.out && !values.apply) process.stdout.write(text)
}
