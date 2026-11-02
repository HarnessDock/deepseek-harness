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
  /**
   * Whether startup without a model credential opens the DeepSeek account welcome window. Products that sign in
   * through their own plugin (LPM: Casdoor in lpm-connect) turn it off and enter the workspace directly.
   */
  readonly deepseekWelcome: boolean
}

export const PRODUCT: DesktopProduct = {
  name: 'LPM',
  home: '.lpm',
  userData: 'HarnessDock LPM',
  deepseekWelcome: false,
}
export const PRODUCT_NAME = PRODUCT.name
