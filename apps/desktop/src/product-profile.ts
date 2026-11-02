/**
 * Product configuration for the profile's own patch layer: the product (product/profile.yml, rendered at packaging time)
 * configures its preinstalled plugins by id-targeted overrides in the profile's cordis.patch.yml, which applies after every
 * bundle layer regardless of bundle order. Each product entry is written between marker comments carrying a hash of what was
 * written: a later app version replaces a block still matching its hash, keeps a block edited since (by hand or through the
 * settings service, e.g. switching environments), and skips ids the user configured outside the markers.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BEGIN = '# >>> product:'
const END = '# <<< product'
const ENTRY = /^- id: ['"]?([^'"\s]+)/
// The hash is absent in markers written before it existed; such blocks count as unedited
const MARKER = /^# >>> product: ([^\s（]+)(?: ([0-9a-f]{12}))?/
const digest = (text: string): string => createHash('sha256').update(text.trim()).digest('hex').slice(0, 12)

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
  /** Product blocks edited since they were written: kept verbatim, in place */
  const edited = new Set<string>()
  let block: { id: string; hash: string; lines: string[] } | undefined
  for (const line of patch.split('\n')) {
    const marker = MARKER.exec(line)
    if (marker?.[1] !== undefined) { block = { id: marker[1], hash: marker[2] ?? '', lines: [line] }; continue }
    if (!block) { kept.push(line); continue }
    block.lines.push(line)
    if (!line.startsWith(END)) continue
    const body = block.lines.slice(1, -1).join('\n')
    if (block.hash && digest(body) !== block.hash) { edited.add(block.id); kept.push(...block.lines) }
    block = undefined
  }
  if (block) kept.push(...block.lines)
  const userIds = new Set(kept.map(line => ENTRY.exec(line)?.[1]).filter(Boolean))
  const blocks = entries.filter(entry => !userIds.has(entry.id) && !edited.has(entry.id))
    .map(entry => `${BEGIN} ${entry.id} ${digest(entry.text)}（随应用更新；改过的保留，要固定自定义请在标记外另写同 id 的条目）\n${entry.text}\n${END}`)
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
