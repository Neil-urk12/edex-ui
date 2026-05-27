import { ipcRenderer } from 'electron'

export const filesystemAPI = {
  readdir: (dirPath) => ipcRenderer.invoke('readdir', dirPath),
  stat: (filePath) => ipcRenderer.invoke('stat', filePath),
  readFile: (filePath, encoding) => ipcRenderer.invoke('readFile', filePath, encoding),
  loadFileIcons: () => ipcRenderer.invoke('loadFileIcons'),
  writeFile: (filePath, content) => ipcRenderer.invoke('writeFile', filePath, content),
  watchDirectory: (dirPath) => ipcRenderer.invoke('watchDirectory', dirPath),
  onFsChanged: (callback) => {
    const handler = (_event, dirPath) => callback(dirPath)
    ipcRenderer.on('fs-changed', handler)
    return () => ipcRenderer.removeListener('fs-changed', handler)
  }
}
