import { app, BrowserWindow, ipcMain, shell, screen, clipboard, globalShortcut, dialog, protocol, net } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, lstatSync, readFile, writeFile, watch } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import which from 'which'
import shellEnv from 'shell-env'
import si from 'systeminformation'
import { TerminalSession } from './terminal.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// --- Error handling ---
process.on('uncaughtException', (e) => {
  // Ignore benign pipe errors during shutdown/cleanup
  if (e.code === 'EPIPE' || e.code === 'ERR_STREAM_DESTROYED') return
  console.error('FATAL:', e)
  try { dialog.showErrorBox('eDEX-UI crashed', e.message || 'Cannot retrieve error message.') } catch (_) {}
  process.exit(1)
})

// --- Single instance lock ---
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  console.error('Another instance of eDEX is already running.')
  app.exit(1)
}

// --- GPU flags ---
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-video-decode')

// --- Paths ---
const userData = app.getPath('userData')
const settingsFile = join(userData, 'settings.json')
const shortcutsFile = join(userData, 'shortcuts.json')
const lastWindowStateFile = join(userData, 'lastWindowState.json')
const themesDir = join(userData, 'themes')
const kblayoutsDir = join(userData, 'keyboards')
const fontsDir = join(userData, 'fonts')

// --- Proxy cleanup ---
delete process.env.http_proxy
delete process.env.https_proxy

// --- Ensure userData dirs ---
for (const dir of [userData, themesDir, kblayoutsDir, fontsDir]) {
  try { mkdirSync(dir) } catch (_) {}
}

// --- Default settings ---
const defaultSettings = {
  shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
  shellArgs: '',
  cwd: userData,
  keyboard: 'en-US',
  theme: 'tron',
  termFontSize: 15,
  audio: true,
  audioVolume: 1.0,
  disableFeedbackAudio: false,
  clockHours: 24,
  pingAddr: '1.1.1.1',
  port: 3000,
  nointro: false,
  nocursor: false,
  forceFullscreen: true,
  allowWindowed: false,
  excludeThreadsFromToplist: true,
  hideDotfiles: false,
  fsListView: false,
  experimentalGlobeFeatures: false,
  experimentalFeatures: false
}

if (!existsSync(settingsFile)) {
  writeFileSync(settingsFile, JSON.stringify(defaultSettings, null, 4))
}

if (!existsSync(shortcutsFile)) {
  writeFileSync(shortcutsFile, JSON.stringify([
    { type: 'app', trigger: 'Ctrl+Shift+C', action: 'COPY', enabled: true },
    { type: 'app', trigger: 'Ctrl+Shift+V', action: 'PASTE', enabled: true },
    { type: 'app', trigger: 'Ctrl+Tab', action: 'NEXT_TAB', enabled: true },
    { type: 'app', trigger: 'Ctrl+Shift+Tab', action: 'PREVIOUS_TAB', enabled: true },
    { type: 'app', trigger: 'Ctrl+X', action: 'TAB_X', enabled: true },
    { type: 'app', trigger: 'Ctrl+Shift+S', action: 'SETTINGS', enabled: true },
    { type: 'app', trigger: 'Ctrl+Shift+K', action: 'SHORTCUTS', enabled: true },
    { type: 'app', trigger: 'Ctrl+Shift+F', action: 'FUZZY_SEARCH', enabled: true },
    { type: 'app', trigger: 'Ctrl+Shift+L', action: 'FS_LIST_VIEW', enabled: true },
    { type: 'app', trigger: 'Ctrl+Shift+H', action: 'FS_DOTFILES', enabled: true },
    { type: 'app', trigger: 'Ctrl+Shift+P', action: 'KB_PASSMODE', enabled: true },
    { type: 'app', trigger: 'Ctrl+Shift+I', action: 'DEV_DEBUG', enabled: false },
    { type: 'app', trigger: 'Ctrl+Shift+F5', action: 'DEV_RELOAD', enabled: true },
    { type: 'shell', trigger: 'Ctrl+Shift+Alt+Space', action: 'neofetch', linebreak: true, enabled: false }
  ], null, 4))
}

if (!existsSync(lastWindowStateFile)) {
  writeFileSync(lastWindowStateFile, JSON.stringify({ useFullscreen: true }, null, 4))
}

// --- Mirror assets to userData ---
function mirrorAssets(srcDir, destDir) {
  try { mkdirSync(destDir, { recursive: true }) } catch (_) {}
  for (const file of readdirSync(srcDir)) {
    const src = join(srcDir, file)
    const dest = join(destDir, file)
    if (lstatSync(src).isDirectory()) {
      mirrorAssets(src, dest)
    } else {
      writeFileSync(dest, readFileSync(src))
    }
  }
}

// Copy all assets to userData
const assetsBase = join(__dirname, '..', '..', 'src', 'assets')
if (existsSync(assetsBase)) {
  mirrorAssets(assetsBase, join(userData, 'assets'))
}
// --- Version history ---
const versionHistoryPath = join(userData, 'versions_log.json')
let versionHistory = {}
try { versionHistory = JSON.parse(readFileSync(versionHistoryPath, 'utf-8')) } catch (_) {}
const version = app.getVersion()
if (!versionHistory[version]) {
  versionHistory[version] = { firstSeen: Date.now(), lastSeen: Date.now() }
} else {
  versionHistory[version].lastSeen = Date.now()
}
writeFileSync(versionHistoryPath, JSON.stringify(versionHistory, null, 2))

// --- Settings IPC ---
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
  let settings = defaultSettings
  try { settings = JSON.parse(readFileSync(settingsFile, 'utf-8')) } catch (_) {}
  Object.assign(settings, partial)
  writeFileSync(settingsFile, JSON.stringify(settings, null, 4))
  return settings
})

// --- App API IPC ---
ipcMain.handle('getAppVersion', () => app.getVersion())
ipcMain.handle('getAppPath', (_event, name) => app.getPath(name))
ipcMain.handle('quitApp', () => app.quit())
ipcMain.handle('getDisplays', () => screen.getAllDisplays().map(d => ({ id: d.id, bounds: d.bounds, workArea: d.workArea })))
ipcMain.handle('getClipboardText', () => clipboard.readText())
ipcMain.handle('setClipboardText', (_event, text) => clipboard.writeText(text))
ipcMain.handle('openPath', (_event, path) => shell.openPath(path))
ipcMain.handle('toggleFullscreen', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen())
  }
})

// --- Shell/shortcut IPC ---
ipcMain.handle('registerShortcut', (_event, accelerator, id) => {
  try {
    globalShortcut.register(accelerator, () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) win.webContents.send('shortcut-triggered', id)
    })
    return true
  } catch (_) { return false }
})

ipcMain.handle('unregisterShortcut', (_event, accelerator) => {
  globalShortcut.unregister(accelerator)
})

// --- Asset content IPC ---
ipcMain.handle('readAsset', (_event, relativePath) => {
  const absPath = join(userData, 'assets', relativePath)
  return readFileSync(absPath, 'utf-8')
})
ipcMain.handle('readFileBinary', (_event, filePath) => {
  return readFileSync(filePath).toString('base64')
})
ipcMain.handle('getTheme', (_event, name) => {
  const absPath = join(themesDir, name + '.json')
  return JSON.parse(readFileSync(absPath, 'utf-8'))
})
ipcMain.handle('getKeyboardLayout', (_event, name) => {
  const absPath = join(kblayoutsDir, name)
  return JSON.parse(readFileSync(absPath, 'utf-8'))
})
ipcMain.handle('getAudioUrl', (_event, filename) => {
  const absPath = join(userData, 'assets', 'audio', filename)
  return `edex-audio://${filename}`
})
ipcMain.handle('getAudioPath', (_event, filename) => join(userData, 'assets', 'audio', filename))
ipcMain.handle('getThemePath', (_event, name) => join(themesDir, name))
ipcMain.handle('getKeyboardPath', (_event, name) => join(kblayoutsDir, name))

// --- Theme/keyboard override IPC ---
let themeOverride = null
let kbOverride = null
ipcMain.handle('getThemeOverride', () => themeOverride)
ipcMain.handle('getKbOverride', () => kbOverride)
ipcMain.on('setThemeOverride', (_e, arg) => { themeOverride = arg })
ipcMain.on('setKbOverride', (_e, arg) => { kbOverride = arg })

// --- Filesystem IPC ---
ipcMain.handle('readdir', async (_event, dirPath) => {
  return readdirSync(dirPath)
})

ipcMain.handle('stat', async (_event, filePath) => {
  if (!filePath) return null
  try {
    const stat = lstatSync(filePath)
    return { isFile: stat.isFile(), isDirectory: stat.isDirectory(), isSymbolicLink: stat.isSymbolicLink(), size: stat.size, mtime: stat.mtime.getTime() }
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'EPERM' || e.code === 'EBUSY') return null
    throw e
  }
})

ipcMain.handle('readFile', async (_event, filePath, encoding) => {
  return readFileSync(filePath, encoding || 'utf-8')
})

ipcMain.handle('writeFile', async (_event, filePath, content) => {
  writeFileSync(filePath, content)
})

let fsWatchers = {}
ipcMain.handle('watchDirectory', async (_event, dirPath) => {
  if (fsWatchers[dirPath]) return
  try {
    const watcher = watch(dirPath, () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) win.webContents.send('fs-changed', 'change')
    })
    fsWatchers[dirPath] = watcher
  } catch (_) {}
})

// --- System information IPC ---
ipcMain.handle('getCpuInfo', () => si.cpu())
ipcMain.handle('getCpuLoad', () => si.currentLoad())
ipcMain.handle('getMemoryInfo', () => si.mem())
ipcMain.handle('getCpuTemperature', () => si.cpuTemperature())
ipcMain.handle('getProcesses', () => si.processes())
ipcMain.handle('getBattery', () => si.battery())
ipcMain.handle('getNetworkInterfaces', () => si.networkInterfaces())
ipcMain.handle('getNetworkStats', (_event, iface) => si.networkStats(iface))
ipcMain.handle('getBlockDevices', () => si.blockDevices())
ipcMain.handle('getFsSize', () => si.fsSize())

// --- Terminal PTY management ---
const terminals = new Map()
let nextTerminalId = 0
let mainWindow = null

ipcMain.handle('terminal:create', async (_event, options) => {
  const settings = JSON.parse(readFileSync(settingsFile, 'utf-8'))
  let cleanEnv
  try {
    cleanEnv = await shellEnv(settings.shell)
  } catch (_) {
    cleanEnv = { ...process.env }
  }
  Object.assign(cleanEnv, {
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERM_PROGRAM: 'eDEX-UI',
    TERM_PROGRAM_VERSION: app.getVersion()
  })

  const id = nextTerminalId++
  const session = new TerminalSession({
    id,
    shell: options.shell || settings.shell,
    params: options.params || settings.shellArgs || [],
    cwd: options.cwd || settings.cwd,
    env: cleanEnv,
    ondata: (_id, data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:data', { id, data })
      }
    },
    onexit: (_id, exitCode, signal) => {
      terminals.delete(id)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:exit', { id, exitCode, signal })
      }
    },
    oncwd: (_id, cwd) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:cwd-changed', { id, cwd })
      }
    },
    onprocess: (_id, proc) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:process-changed', { id, process: proc })
      }
    }
  })
  terminals.set(id, session)
  return id
})

ipcMain.on('terminal:write', (_event, { id, data }) => {
  const session = terminals.get(id)
  if (session) session.write(data)
})

ipcMain.on('terminal:resize', (_event, { id, cols, rows }) => {
  const session = terminals.get(id)
  if (session) session.resize(cols, rows)
})

ipcMain.handle('terminal:kill', (_event, id) => {
  const session = terminals.get(id)
  if (session) {
    session.kill()
    terminals.delete(id)
  }
})

// --- Window creation ---
function createWindow(settings) {
  const displays = screen.getAllDisplays()
  let display
  if (!isNaN(settings.monitor)) {
    display = displays[settings.monitor] || screen.getPrimaryDisplay()
  } else {
    display = screen.getPrimaryDisplay()
  }
  let { x, y, width, height } = display.bounds
  width++
  height++

  mainWindow = new BrowserWindow({
    title: 'eDEX-UI',
    x, y, width, height,
    show: false,
    resizable: true,
    movable: settings.allowWindowed || false,
    fullscreen: settings.forceFullscreen || false,
    autoHideMenuBar: true,
    frame: settings.allowWindowed || false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      webSecurity: true,
      experimentalFeatures: settings.experimentalFeatures || false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    console.log('[MAIN] Loading renderer URL:', process.env.ELECTRON_RENDERER_URL);
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    console.log('[MAIN] Loading renderer file:', join(__dirname, '../renderer/index.html'));
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('[MAIN] Renderer failed to load:', code, desc)
  })
  mainWindow.webContents.on('render-process-gone', (e, details) => {
    console.error('[MAIN] Renderer process gone:', details)
  })
  mainWindow.webContents.on('console-message', (e, level, message, line, sourceId) => {
    const levels = ['verbose','info','warning','error'];
    console.log('[RENDERER]', levels[level] || level, message, sourceId ? `(${sourceId}:${line})` : '')
  })

  mainWindow.once('ready-to-show', () => {
    console.log('[MAIN] ready-to-show fired, showing window')
    mainWindow.show()
  })

  // Security: prevent new windows, restrict navigation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url !== mainWindow.webContents.getURL()) e.preventDefault()
  })
}

// Register custom audio scheme as privileged (must be before app.whenReady)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'edex-audio',
    privileges: { bypassCSP: true, stream: true, supportFetchAPI: true }
  }
])
// --- App lifecycle ---
app.whenReady().then(async () => {
  // Register custom protocol for audio files (file:// blocked from http origins)
  protocol.handle('edex-audio', (request) => {
    const filePath = join(userData, 'assets', 'audio', decodeURIComponent(request.url.replace('edex-audio://', '')))
    return net.fetch(pathToFileURL(filePath).href)
  })
  let settings = defaultSettings
  try { settings = JSON.parse(readFileSync(settingsFile, 'utf-8')) } catch (_) {}

  // Resolve shell path
  try {
    settings.shell = await which(settings.shell)
  } catch (_) {
    settings.shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
  }

  createWindow(settings)

  // Copy audio assets to userData (for howler.js access)
  const audioSrc = join(assetsBase, 'audio')
  const audioDest = join(userData, 'assets', 'audio')
  try { mkdirSync(audioDest, { recursive: true }) } catch (_) {}
  if (existsSync(audioSrc)) {
    for (const file of readdirSync(audioSrc)) {
      writeFileSync(join(audioDest, file), readFileSync(join(audioSrc, file)))
    }
  }

  // Also copy boot_log.txt
  const miscSrc = join(assetsBase, 'misc')
  const miscDest = join(userData, 'assets', 'misc')
  try { mkdirSync(miscDest, { recursive: true }) } catch (_) {}
  if (existsSync(join(miscSrc, 'boot_log.txt'))) {
    writeFileSync(join(miscDest, 'boot_log.txt'), readFileSync(join(miscSrc, 'boot_log.txt')))
  }

})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  for (const [, session] of terminals) {
    try { session.kill() } catch (_) {}
  }
})
