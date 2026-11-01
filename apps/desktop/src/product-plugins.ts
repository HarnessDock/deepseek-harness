/**
 * First-launch installation of the product's own plugins: the installer carries their tarballs in Resources/product-plugins,
 * and before the Host starts they are added to the Desktop profile with the bundled `dsh plugin` command. Once installed
 * they are ordinary profile plugins, so the Plugins page can update, disable or remove them; a marker file records which
 * tarballs were installed, so a removed plugin stays removed and a newer tarball in an app update installs over the old one.
 */

import { execFile } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

const MARKER = '.product-plugins.json'

/**
 * Install product plugin tarballs not yet installed into the profile; failures are reported and never block startup.
 * @param resources - Packaged application resources directory.
 * @param profile - Desktop profile directory.
 */
export async function installProductPlugins(resources: string, profile: string): Promise<void> {
  const source = join(resources, 'product-plugins')
  if (!existsSync(source)) return
  const tarballs = readdirSync(source).filter(file => file.endsWith('.tgz')).sort()
  const markerPath = join(profile, MARKER)
  let installed: string[] = []
  try { installed = (JSON.parse(readFileSync(markerPath, 'utf8')) as { installed: string[] }).installed } catch { /* first launch */ }
  const missing = tarballs.filter(file => !installed.includes(file))
  if (missing.length === 0) return
  // The profile records file: dependencies by path, so install from copies that move with the profile, not the app bundle
  const local = join(profile, 'product-plugins')
  mkdirSync(local, { recursive: true, mode: 0o700 })
  for (const file of missing) copyFileSync(join(source, file), join(local, file))
  // Same invocation as the installed `dsh` launcher: this executable in Node mode running the private Host CLI
  const cli = join(resources, 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js')
  try {
    await promisify(execFile)(process.execPath, ['--expose-internals', cli, 'plugin', '--profile', 'desktop', 'add',
      ...missing.map(file => `file:${join(local, file)}`)], {
      timeout: 300_000,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    })
    writeFileSync(markerPath, `${JSON.stringify({ installed: [...installed, ...missing] }, undefined, 2)}\n`, { mode: 0o600 })
  } catch (error) {
    console.error('desktop: product plugin installation failed', error)
  }
}
