/** Main-process side effect: product-owned DSH_HOME and Electron user data, set before any module resolves paths. */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { PRODUCT } from './product.ts'

// Keep this product's sessions, profiles and credentials apart from other Harness installations; an explicit DSH_HOME still wins.
process.env.DSH_HOME ??= join(homedir(), PRODUCT.home)

// Packaged builds keep Chromium storage apart from official Harness and earlier LPM shells; development passes --user-data-dir.
if (app.isPackaged) app.setPath('userData', join(app.getPath('appData'), PRODUCT.userData))
