/**
 * Product configuration for the profile's own patch layer: the product (product/profile.yml, rendered at packaging time)
 * configures its preinstalled plugins by id-targeted overrides in the profile's cordis.patch.yml, which applies after every
 * bundle layer regardless of bundle order. Each product entry is written between marker comments so a later app version can
 * replace it; an entry the user wrote for the same id (outside the markers) wins and the product's is skipped.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BEGIN = '# >>> product:'
const END = '# <<< product'
const ENTRY = /^- id: ['"]?([^'"\s]+)/

/** One top-level `- id:` entry of the product profile with the comment lines directly above it. */
interface ProductEntry { id: string; text: string }

/**
 * Split a product profile into its top-level `- id:` entries.
 * @param text - Rendered product profile YAML.
 * @returns Entries in file order; header comments and blank lines between entries are dropped.
 */
export function productEntries(text: string): ProductEntry[] {
  const entries: ProductEntry[] = []
  let comments: string[] = []
  let current: { id: string; lines: string[] } | undefined
  const flush = (): void => { if (current) entries.push({ id: current.id, text: current.lines.join('\n') }); current = undefined }
  for (const line of text.split('\n')) {
    const match = ENTRY.exec(line)
    if (match?.[1] !== undefined) { flush(); current = { id: match[1], lines: [...comments, line] }; comments = []; continue }
    if (current && /^\s+\S/.test(line)) { current.lines.push(line); continue }
    if (line.startsWith('#')) { flush(); comments.push(line); continue }
    flush()
    comments = []
  }
  flush()
  return entries
}

/**
 * Merge product entries into a profile patch text: drop the previous product blocks, keep everything else, and append
 * the product's entries for ids the user does not override themselves.
 * @param patch - Current profile cordis.patch.yml text (may be `[]`).
 * @param entries - Product entries to write.
 * @returns The new patch text.
 */
export function mergeProductEntries(patch: string, entries: ProductEntry[]): string {
  const kept: string[] = []
  let inside = false
  for (const line of patch.split('\n')) {
    if (line.startsWith(BEGIN)) { inside = true; continue }
    if (inside) { if (line.startsWith(END)) inside = false; continue }
    kept.push(line)
  }
  const userIds = new Set(kept.map(line => ENTRY.exec(line)?.[1]).filter(Boolean))
  const blocks = entries.filter(entry => !userIds.has(entry.id)).map(entry => `${BEGIN} ${entry.id}（随应用更新，要自定义请在标记外另写同 id 的条目）\n${entry.text}\n${END}`)
  const body = kept.join('\n').replace(/\n+$/, '')
  const base = /^\s*(#.*\n)*\s*\[\]\s*$/.test(body) ? body.replace(/\[\]\s*$/, '').replace(/\n+$/, '') : body
  return `${[base, ...blocks].filter(Boolean).join('\n')}\n`
}

/**
 * Write the product profile into a profile directory's cordis.patch.yml.
 * @param productProfile - Path of the rendered product profile.
 * @param profile - Profile directory.
 * @returns Whether the patch file changed.
 */
export function applyProductProfile(productProfile: string, profile: string): boolean {
  if (!existsSync(productProfile)) return false
  const patchPath = join(profile, 'cordis.patch.yml')
  const before = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : '[]\n'
  const after = mergeProductEntries(before, productEntries(readFileSync(productProfile, 'utf8')))
  if (after === before) return false
  // Same as dsh's own patch writes: temp file + rename, owner-only
  const temp = `${patchPath}.${process.pid}.tmp`
  writeFileSync(temp, after, { mode: 0o600 })
  renameSync(temp, patchPath)
  return true
}
