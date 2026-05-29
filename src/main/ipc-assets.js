import { join } from 'path'
import { readJsonFile } from './ipc-helpers.js'

let themeOverride = null
let kbOverride = null

export function register(ipcMain, { userData, themesDir, kblayoutsDir, assetHashes, readFileSync, createHash, validateAssetPath, validateAndResolve, validateWithin }) {
  ipcMain.handle('readAsset', (_event, relativePath) => {
    const absResolved = validateAssetPath(relativePath, userData)
    return readFileSync(absResolved, 'utf-8')
  })

  ipcMain.handle('loadFileIcons', async (_event) => {
    const resolved = validateAssetPath('misc/file-icons-match.js', userData)
    // Verify file integrity before executing to prevent RCE via tampered assets
    const content = readFileSync(resolved, 'utf-8')
    const actualHash = createHash('sha256').update(content).digest('hex')
    if (!assetHashes['misc/file-icons-match.js']) {
      throw new Error('Asset hash not available for misc/file-icons-match.js — file may have been added after startup. Restart the app to regenerate hashes.')
    }
    if (actualHash !== assetHashes['misc/file-icons-match.js']) {
      throw new Error(`Asset integrity check failed: misc/file-icons-match.js has been tampered with. Expected ${assetHashes['misc/file-icons-match.js'].slice(0, 16)}, got ${actualHash.slice(0, 16)}`)
    }
    const { createRequire } = await import('module')
    const req = createRequire(resolved)
    return req(resolved)
  })

  ipcMain.handle('readFileBinary', (_event, filePath) => {
    const resolved = validateWithin(filePath, userData)
    return readFileSync(resolved).toString('base64')
  })

  ipcMain.handle('getTheme', (_event, name) => {
    const resolved = validateAndResolve(name + '.json', themesDir)
    return readJsonFile(resolved, {})
  })

  ipcMain.handle('getKeyboardLayout', (_event, name) => {
    const resolved = validateAndResolve(name, kblayoutsDir)
    return readJsonFile(resolved, {})
  })

  ipcMain.handle('getAudioUrl', (_event, filename) => {
    validateAndResolve(filename, join(userData, 'assets', 'audio'))
    return `edex-audio://${filename}`
  })

  ipcMain.handle('getAudioPath', (_event, filename) => {
    return validateAndResolve(filename, join(userData, 'assets', 'audio'))
  })

  ipcMain.handle('getThemePath', (_event, name) => {
    return validateAndResolve(name, themesDir)
  })

  ipcMain.handle('getKeyboardPath', (_event, name) => {
    return validateAndResolve(name, kblayoutsDir)
  })

  ipcMain.handle('getThemeOverride', () => themeOverride)
  ipcMain.handle('getKbOverride', () => kbOverride)
  ipcMain.on('setThemeOverride', (_e, arg) => { themeOverride = arg })
  ipcMain.on('setKbOverride', (_e, arg) => { kbOverride = arg })
}
