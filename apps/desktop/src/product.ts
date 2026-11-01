/**
 * Product identity of this Desktop build (HarnessDock lpm-desktop branch). Packaging reads ../product.json;
 * `name` must match its `name`, which electron-builder uses for the app bundle and installer.
 */

/** Product customization compiled into the main process. */
export interface DesktopProduct {
  /** Application, menu, dialog and About name. */
  readonly name: string
  /** Default Harness home under the user's home directory when DSH_HOME is unset. */
  readonly home: string
  /** Electron user-data directory name under the platform application-data folder (packaged builds). */
  readonly userData: string
}

export const PRODUCT: DesktopProduct = {
  name: 'LPM',
  home: '.lpm',
  userData: 'HarnessDock LPM',
}
export const PRODUCT_NAME = PRODUCT.name
