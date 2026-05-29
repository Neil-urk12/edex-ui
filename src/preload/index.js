import { contextBridge, ipcRenderer } from 'electron'

function listen(channel, unpack) {
  return (callback) => {
    const handler = (_event, ...args) => callback(...unpack(...args))
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // ── App ──────────────────────────────────────────────────────────────
  getAppVersion: () => ipcRenderer.invoke('getAppVersion'),
  getAppPath: (name) => ipcRenderer.invoke('getAppPath', name),
  quitApp: () => ipcRenderer.invoke('quitApp'),
  getDisplays: () => ipcRenderer.invoke('getDisplays'),
  getClipboardText: () => ipcRenderer.invoke('getClipboardText'),
  setClipboardText: (text) => ipcRenderer.invoke('setClipboardText', text),
  openPath: (path) => ipcRenderer.invoke('openPath', path),
  registerShortcut: (accelerator, id) => ipcRenderer.invoke('registerShortcut', accelerator, id),
  unregisterShortcut: (accelerator) => ipcRenderer.invoke('unregisterShortcut', accelerator),
  getSettings: () => ipcRenderer.invoke('getSettings'),
  saveSettings: (partial) => ipcRenderer.invoke('saveSettings', partial),
  getAudioPath: (filename) => ipcRenderer.invoke('getAudioPath', filename),
  getAudioUrl: (filename) => ipcRenderer.invoke('getAudioUrl', filename),
  getThemePath: (name) => ipcRenderer.invoke('getThemePath', name),
  getTheme: (name) => ipcRenderer.invoke('getTheme', name),
  getKeyboardPath: (name) => ipcRenderer.invoke('getKeyboardPath', name),
  getKeyboardLayout: (name) => ipcRenderer.invoke('getKeyboardLayout', name),
  readAsset: (relativePath) => ipcRenderer.invoke('readAsset', relativePath),
  readFileBinary: (filePath) => ipcRenderer.invoke('readFileBinary', filePath),
  getThemeOverride: () => ipcRenderer.invoke('getThemeOverride'),
  getKbOverride: () => ipcRenderer.invoke('getKbOverride'),
  setThemeOverride: (arg) => ipcRenderer.send('setThemeOverride', arg),
  setKbOverride: (arg) => ipcRenderer.send('setKbOverride', arg),
  onShortcutTriggered: listen('shortcut-triggered', (id) => [id]),
  toggleFullscreen: () => ipcRenderer.invoke('toggleFullscreen'),

  // ── Terminal ─────────────────────────────────────────────────────────
  createTerminal: (options) => ipcRenderer.invoke('terminal:create', options),
  writeTerminal: (id, data) => ipcRenderer.send('terminal:write', { id, data }),
  resizeTerminal: (id, cols, rows) => ipcRenderer.send('terminal:resize', { id, cols, rows }),
  killTerminal: (id) => ipcRenderer.invoke('terminal:kill', id),
  onTerminalData: listen('terminal:data', ({ id, data }) => [id, data]),
  onTerminalExit: listen('terminal:exit', ({ id, exitCode, signal }) => [id, exitCode, signal]),
  onCwdChanged: listen('terminal:cwd-changed', ({ id, cwd }) => [id, cwd]),
  onProcessChanged: listen('terminal:process-changed', ({ id, process }) => [id, process]),

  // ── Filesystem ───────────────────────────────────────────────────────
  readdir: (dirPath) => ipcRenderer.invoke('readdir', dirPath),
  stat: (filePath) => ipcRenderer.invoke('stat', filePath),
  readFile: (filePath, encoding) => ipcRenderer.invoke('readFile', filePath, encoding),
  loadFileIcons: () => ipcRenderer.invoke('loadFileIcons'),
  writeFile: (filePath, content) => ipcRenderer.invoke('writeFile', filePath, content),
  watchDirectory: (dirPath) => ipcRenderer.invoke('watchDirectory', dirPath),
  onFsChanged: listen('fs-changed', (dirPath) => [dirPath]),

  // ── System ───────────────────────────────────────────────────────────
  getCpuInfo: () => ipcRenderer.invoke('getCpuInfo'),
  getCpuLoad: () => ipcRenderer.invoke('getCpuLoad'),
  getMemoryInfo: () => ipcRenderer.invoke('getMemoryInfo'),
  getCpuTemperature: () => ipcRenderer.invoke('getCpuTemperature'),
  getProcesses: () => ipcRenderer.invoke('getProcesses'),
  getBattery: () => ipcRenderer.invoke('getBattery'),
  getNetworkInterfaces: () => ipcRenderer.invoke('getNetworkInterfaces'),
  getNetworkStats: (iface) => ipcRenderer.invoke('getNetworkStats', iface),
  getBlockDevices: () => ipcRenderer.invoke('getBlockDevices'),
  getFsSize: () => ipcRenderer.invoke('getFsSize'),
  getSystemInfo: () => ipcRenderer.invoke('getSystemInfo'),
  getChassisInfo: () => ipcRenderer.invoke('getChassisInfo'),
  getSystemUptime: () => ipcRenderer.invoke('getSystemUptime')
})
