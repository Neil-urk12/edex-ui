import { ipcRenderer } from 'electron'

export const appAPI = {
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
  onShortcutTriggered: (callback) => {
    const handler = (_event, id) => callback(id)
    ipcRenderer.on('shortcut-triggered', handler)
    return () => ipcRenderer.removeListener('shortcut-triggered', handler)
  }
}
