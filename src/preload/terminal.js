import { ipcRenderer } from 'electron'

export const terminalAPI = {
  createTerminal: (options) => ipcRenderer.invoke('terminal:create', options),
  writeTerminal: (id, data) => ipcRenderer.send('terminal:write', { id, data }),
  resizeTerminal: (id, cols, rows) => ipcRenderer.send('terminal:resize', { id, cols, rows }),
  killTerminal: (id) => ipcRenderer.invoke('terminal:kill', id),
  onTerminalData: (callback) => {
    const handler = (_event, { id, data }) => callback(id, data)
    ipcRenderer.on('terminal:data', handler)
    return () => ipcRenderer.removeListener('terminal:data', handler)
  },
  onTerminalExit: (callback) => {
    const handler = (_event, { id, exitCode, signal }) => callback(id, exitCode, signal)
    ipcRenderer.on('terminal:exit', handler)
    return () => ipcRenderer.removeListener('terminal:exit', handler)
  },
  onCwdChanged: (callback) => {
    const handler = (_event, { id, cwd }) => callback(id, cwd)
    ipcRenderer.on('terminal:cwd-changed', handler)
    return () => ipcRenderer.removeListener('terminal:cwd-changed', handler)
  },
  onProcessChanged: (callback) => {
    const handler = (_event, { id, process }) => callback(id, process)
    ipcRenderer.on('terminal:process-changed', handler)
    return () => ipcRenderer.removeListener('terminal:process-changed', handler)
  }
}
