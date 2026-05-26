import { contextBridge } from 'electron'
import { appAPI } from './app.js'
import { terminalAPI } from './terminal.js'
import { filesystemAPI } from './filesystem.js'
import { systemAPI } from './system.js'

contextBridge.exposeInMainWorld('electronAPI', {
  ...appAPI,
  ...terminalAPI,
  ...filesystemAPI,
  ...systemAPI
})
