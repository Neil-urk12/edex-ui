import { join } from 'path'

const SETTINGS_ALLOWLIST = [
  'keyboard', 'theme', 'termFontSize', 'audio', 'audioVolume', 'disableFeedbackAudio',
  'clockHours', 'pingAddr', 'port', 'nointro', 'nocursor', 'forceFullscreen', 'allowWindowed',
  'excludeThreadsFromToplist', 'hideDotfiles', 'fsListView', 'experimentalGlobeFeatures', 'experimentalFeatures'
]

export function register(ipcMain, { settingsFile, defaultSettings, userData, readFileSync, writeFileSync }) {
  ipcMain.handle('getSettings', () => {
    let settings
    try { settings = JSON.parse(readFileSync(settingsFile, 'utf-8')) } catch (_) { settings = { ...defaultSettings } }
    settings.settingsDir = userData
    settings.themesPath = join(userData, 'themes')
    settings.kbLayoutPath = join(userData, 'keyboards')
    settings.settingsFile = settingsFile
    return settings
  })

  ipcMain.handle('saveSettings', (_event, partial) => {
    let settings = { ...defaultSettings }
    try { Object.assign(settings, JSON.parse(readFileSync(settingsFile, 'utf-8'))) } catch (_) {}
    if (partial && typeof partial === 'object') {
      for (const key of SETTINGS_ALLOWLIST) {
        if (Object.hasOwn(partial, key)) settings[key] = partial[key]
      }
    }
    writeFileSync(settingsFile, JSON.stringify(settings, null, 4))
    return settings
  })
}
