import { join } from 'path'
import { getSchemaKeys } from '../shared/settings-schema.js'

// Keys blocked from IPC write — shell, shellArgs, cwd, env, username for security
const UNSAVEABLE_KEYS = new Set(['shell', 'shellArgs', 'cwd', 'env', 'username'])
const SETTINGS_ALLOWLIST = getSchemaKeys().filter(k => !UNSAVEABLE_KEYS.has(k))

export function register(ipcMain, { settingsFile, defaultSettings, userData, writeFileSync, readJsonFile: readJson }) {
  ipcMain.handle('getSettings', () => {
    const settings = readJson(settingsFile, { ...defaultSettings })
    settings.settingsDir = userData
    settings.themesPath = join(userData, 'themes')
    settings.kbLayoutPath = join(userData, 'keyboards')
    settings.settingsFile = settingsFile
    return settings
  })

  ipcMain.handle('saveSettings', (_event, partial) => {
    let settings = { ...defaultSettings }
    Object.assign(settings, readJson(settingsFile, {}))
    if (partial && typeof partial === 'object') {
      for (const key of SETTINGS_ALLOWLIST) {
        if (Object.hasOwn(partial, key)) settings[key] = partial[key]
      }
    }
    writeFileSync(settingsFile, JSON.stringify(settings, null, 4))
    return settings
  })
}
