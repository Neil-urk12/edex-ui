import { app, BrowserWindow, ipcMain, shell, screen, clipboard, globalShortcut, dialog, protocol, net } from 'electron'
import { join, dirname, extname, basename } from 'path'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, lstatSync, watch } from 'fs'
import { createHash } from 'crypto'
import { fileURLToPath, pathToFileURL } from 'url'
import which from 'which'
import shellEnv from 'shell-env'
import { register as registerSystemHandlers } from './ipc-system.js'
import { register as registerSettingsHandlers } from './ipc-settings.js'
import { register as registerAssetHandlers } from './ipc-assets.js'
import { register as registerFilesystemHandlers, dispose as disposeFilesystemWatchers } from './ipc-filesystem.js'
import { TerminalSession } from './terminal.js'
import { validateFilename, validateAndResolve, validateWithin, validateAssetPath } from './ipc-validation.js'
import si from 'systeminformation'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// --- Error handling ---
process.on('uncaughtException', (e) => {
  // Ignore benign pipe errors during shutdown/cleanup
  if (e.code === 'EPIPE' || e.code === 'ERR_STREAM_DESTROYED') return
  console.error('FATAL:', e)
  try { dialog.showErrorBox('eDEX-UI crashed', e.message || 'Cannot retrieve error message.') } catch {}
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
  try { mkdirSync(dir) } catch {}
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
  try { mkdirSync(destDir, { recursive: true }) } catch {}
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
// Compute and store SHA-256 hashes of security-sensitive asset files for integrity verification
const assetHashes = {}
const hashedAssets = ['misc/file-icons-match.js']
for (const relPath of hashedAssets) {
  const fullPath = join(userData, 'assets', relPath)
  if (existsSync(fullPath)) {
    assetHashes[relPath] = createHash('sha256').update(readFileSync(fullPath)).digest('hex')
  }
}
// --- Version history ---
const versionHistoryPath = join(userData, 'versions_log.json')
let versionHistory = {}
try { versionHistory = JSON.parse(readFileSync(versionHistoryPath, 'utf-8')) } catch {}
const version = app.getVersion()
if (!versionHistory[version]) {
  versionHistory[version] = { firstSeen: Date.now(), lastSeen: Date.now() }
} else {
  versionHistory[version].lastSeen = Date.now()
}
writeFileSync(versionHistoryPath, JSON.stringify(versionHistory, null, 2))

// --- Settings IPC (delegated to ipc-settings.js) ---
registerSettingsHandlers(ipcMain, { settingsFile, defaultSettings, userData, readFileSync, writeFileSync })

const SAFE_OPEN_EXTENSIONS = [
  // Original
  '.txt', '.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.md', '.html', '.css', '.js', '.wav', '.mp3', '.ogg',
  // Data
  '.log', '.csv', '.tsv', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  // Media
  '.svg', '.mp4', '.webm', '.mkv', '.avi', '.mov', '.flac', '.m4a', '.aac', '.opus', '.bmp', '.tiff', '.ico', '.avif',
  // Documents
  '.rtf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
  // Archives
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  // Web
  '.jsx', '.tsx', '.ts', '.vue', '.svelte', '.astro', '.scss', '.less', '.sass',
]
// --- App API IPC ---
ipcMain.handle('getAppVersion', () => app.getVersion())
const ALLOWED_APP_PATHS = ['home', 'appData', 'userData', 'desktop', 'documents', 'downloads', 'temp', 'logs', 'crashDumps']
ipcMain.handle('getAppPath', (_event, name) => {
  if (!ALLOWED_APP_PATHS.includes(name)) {
    throw new Error('Invalid path name: not allowed')
  }
  return app.getPath(name)
})
ipcMain.handle('quitApp', () => app.quit())
ipcMain.handle('getDisplays', () => screen.getAllDisplays().map(d => ({ id: d.id, bounds: d.bounds, workArea: d.workArea })))
ipcMain.handle('getClipboardText', () => clipboard.readText())
ipcMain.handle('setClipboardText', (_event, text) => clipboard.writeText(text))
ipcMain.handle('openPath', (_event, path) => {
  const resolved = validateWithin(path, userData)
  try {
    const stat = lstatSync(resolved)
    if (stat.isDirectory()) {
      throw new Error('Cannot open directory')
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  const ext = extname(resolved).toLowerCase()
  if (ext && !SAFE_OPEN_EXTENSIONS.includes(ext)) {
    throw new Error('File type not allowed')
  }
  return shell.openPath(resolved)
})
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
  } catch { return false }
})

ipcMain.handle('unregisterShortcut', (_event, accelerator) => {
  globalShortcut.unregister(accelerator)
})

// --- Asset content IPC (delegated to ipc-assets.js) ---
registerAssetHandlers(ipcMain, {
  userData, themesDir, kblayoutsDir, assetHashes,
  readFileSync, createHash,
  validateAssetPath, validateAndResolve, validateWithin
})

// --- Filesystem IPC (delegated to ipc-filesystem.js) ---
registerFilesystemHandlers(ipcMain, {
  userData, readdirSync, lstatSync, readFileSync, writeFileSync,
  watch, validateWithin, BrowserWindow
})

// --- System information IPC (delegated to ipc-system.js) ---
registerSystemHandlers(ipcMain, { si })

// --- Terminal PTY management ---
const terminals = new Map()
let nextTerminalId = 0
let mainWindow = null

ipcMain.handle('terminal:create', async (_event, options) => {
  const settings = JSON.parse(readFileSync(settingsFile, 'utf-8'))
  let cleanEnv
  try {
    cleanEnv = await shellEnv(settings.shell)
  } catch {
    cleanEnv = { ...process.env }
  }
  Object.assign(cleanEnv, {
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERM_PROGRAM: 'eDEX-UI',
    TERM_PROGRAM_VERSION: app.getVersion()
  })

  // Trusted shell directories — resolved shell must be in one of these
  const TRUSTED_SHELL_DIRS = [
    '/bin/', '/usr/bin/', '/usr/local/bin/',
    '/opt/homebrew/bin/',
    '/run/current-system/sw/bin/',
    '/snap/bin/',
  ]
  const TRUSTED_WINDOWS_SHELLS = ['powershell.exe', 'cmd.exe', 'pwsh.exe']
  const ALLOWED_SHELL_NAMES = ['bash', 'sh', 'zsh', 'fish', 'powershell.exe', 'cmd.exe', 'pwsh.exe']

  function isShellAllowed(resolvedPath) {
    const base = basename(resolvedPath).toLowerCase()
    if (TRUSTED_WINDOWS_SHELLS.includes(base)) return true
    if (!TRUSTED_SHELL_DIRS.some(dir => resolvedPath.startsWith(dir))) return false
    return ALLOWED_SHELL_NAMES.includes(base)
  }

  const requestedShell = options.shell || settings.shell;
  const resolvedShell = await which(requestedShell).catch(() => null);
  let shell = settings.shell; // default
  if (resolvedShell && isShellAllowed(resolvedShell)) {
    shell = resolvedShell;
  } else {
    const fallbackResolved = await which(settings.shell).catch(() => null);
    if (fallbackResolved && isShellAllowed(fallbackResolved)) {
      shell = fallbackResolved;
    } else {
      throw new Error('No allowed shell available: both requested and configured shells failed allowlist validation');
    }
  }

  // Sanitize params - reject shell metacharacters and dangerous flags
  const rawParams = options.params || settings.shellArgs || [];
  for (const p of rawParams) {
    // oxlint-disable-next-line no-control-regex — intentional for shell injection prevention
    if (typeof p !== 'string' || /[;&|`$(){}!<>~'"\\]/u.test(p) || /\u000a|\u000d|\u0009|\u0000|#/u.test(p)) {
      throw new Error('Invalid shell parameter: contains forbidden characters');
    }
    if (/^-[a-zA-Z]*[cC]$|^\/[cC]$|^--command([= ]|$)/.test(p)) {
      throw new Error('Invalid shell parameter: -c flag not allowed');
    }
  }
  const params = rawParams;
  const id = nextTerminalId++
  const session = new TerminalSession({
    id,
    shell,
    params,
    cwd: options.cwd ? validateWithin(options.cwd, userData) : settings.cwd,
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
    try {
      const parsed = new URL(url);
      const allowedSchemes = ['https:', 'http:', 'mailto:'];
      if (allowedSchemes.includes(parsed.protocol)) {
        shell.openExternal(url);
      }
    } catch {
      // Invalid URL, ignore
    }
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
    const raw = decodeURIComponent(request.url.replace('edex-audio://', ''))
    try {
      validateFilename(raw)
    } catch {
      return new Response('Invalid path', { status: 400 })
    }
    let resolved
    try {
      resolved = validateWithin(join(userData, 'assets', 'audio', raw), join(userData, 'assets', 'audio'))
    } catch {
      return new Response('Path traversal', { status: 403 })
    }
    return net.fetch(pathToFileURL(resolved).href)
  })
  let settings = defaultSettings
  try { settings = JSON.parse(readFileSync(settingsFile, 'utf-8')) } catch {}

  // Resolve shell path
  try {
    settings.shell = await which(settings.shell)
  } catch {
    settings.shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
  }

  createWindow(settings)

  // Copy audio assets to userData (for howler.js access)
  const audioSrc = join(assetsBase, 'audio')
  const audioDest = join(userData, 'assets', 'audio')
  try { mkdirSync(audioDest, { recursive: true }) } catch {}
  if (existsSync(audioSrc)) {
    for (const file of readdirSync(audioSrc)) {
      writeFileSync(join(audioDest, file), readFileSync(join(audioSrc, file)))
    }
  }

  // Also copy boot_log.txt
  const miscSrc = join(assetsBase, 'misc')
  const miscDest = join(userData, 'assets', 'misc')
  try { mkdirSync(miscDest, { recursive: true }) } catch {}
  if (existsSync(join(miscSrc, 'boot_log.txt'))) {
    writeFileSync(join(miscDest, 'boot_log.txt'), readFileSync(join(miscSrc, 'boot_log.txt')))
  }

})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  disposeFilesystemWatchers()
  for (const [, session] of terminals) {
    try { session.kill() } catch {}
  }
})
