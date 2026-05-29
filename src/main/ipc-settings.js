import { join } from 'path'
import { readJsonFile } from './ipc-helpers.js'

const SETTINGS_ALLOWLIST = [
  'keyboard', 'theme', 'termFontSize', 'audio', 'audioVolume', 'disableFeedbackAudio',
  'clockHours', 'pingAddr', 'port', 'nointro', 'nocursor', 'forceFullscreen', 'allowWindowed',
  'excludeThreadsFromToplist', 'hideDotfiles', 'fsListView', 'experimentalGlobeFeatures', 'experimentalFeatures'
]

export function register(ipcMain, { settingsFile, defaultSettings, userData, writeFileSync }) {
  ipcMain.handle('getSettings', () => {
    const settings = readJsonFile(settingsFile, { ...defaultSettings })
    settings.settingsDir = userData
    settings.themesPath = join(userData, 'themes')
    settings.kbLayoutPath = join(userData, 'keyboards')
    settings.settingsFile = settingsFile
    return settings
  })

  ipcMain.handle('saveSettings', (_event, partial) => {
    let settings = { ...defaultSettings }
    Object.assign(settings, readJsonFile(settingsFile, {}))
    if (partial && typeof partial === 'object') {
      for (const key of SETTINGS_ALLOWLIST) {
        if (Object.hasOwn(partial, key)) settings[key] = partial[key]
      }
    }
    writeFileSync(settingsFile, JSON.stringify(settings, null, 4))
    return settings
  })
}
