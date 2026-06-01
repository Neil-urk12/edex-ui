// readdir and stat are intentionally unrestricted (no validateWithin) to support
// the built-in filesystem browser which navigates arbitrary paths. Only null-byte
// injection is blocked. readFile/writeFile remain restricted to userData.

import { extname } from 'path'

let fsWatchers = {}

export function register(ipcMain, { userData, readdirSync, lstatSync, readFileSync, writeFileSync, watch, validateWithin, BrowserWindow, safeOpenExtensions, shell: electronShell }) {
  ipcMain.handle('readdir', (_event, dirPath) => {
    if (!dirPath) return []
    if (typeof dirPath !== 'string' || dirPath.includes('\0')) throw new Error('Invalid path')
    try {
      return readdirSync(dirPath)
    } catch (e) {
      if (e.code === 'EPERM') {
        console.warn('[readdir] EPERM Permission denied:', dirPath)
        return []
      }
      if (e.code === 'ENOENT' || e.code === 'EBUSY') return []
      return Promise.reject(e)
    }
  })

  ipcMain.handle('stat', (_event, filePath) => {
    if (!filePath) return null
    if (typeof filePath !== 'string' || filePath.includes('\0')) throw new Error('Invalid path')
    try {
      const stat = lstatSync(filePath)
      return { isFile: stat.isFile(), isDirectory: stat.isDirectory(), isSymbolicLink: stat.isSymbolicLink(), size: stat.size, mtime: stat.mtime.getTime() }
    } catch (e) {
      if (e.code === 'EPERM') {
        console.warn('[stat] EPERM Permission denied:', filePath)
        return null
      }
      if (e.code === 'ENOENT' || e.code === 'EBUSY') return null
      return Promise.reject(e)
    }
  })

  ipcMain.handle('readFile', (_event, filePath, encoding) => {
    const resolved = validateWithin(filePath, userData)
    return readFileSync(resolved, encoding || 'utf-8')
  })

  ipcMain.handle('writeFile', (_event, filePath, content) => {
    const resolved = validateWithin(filePath, userData)
    writeFileSync(resolved, content)
  })

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
    if (ext && !safeOpenExtensions.includes(ext)) {
      throw new Error('File type not allowed')
    }
    return electronShell.openPath(resolved)
  })

  ipcMain.handle('watchDirectory', async (_event, dirPath) => {
    const resolved = validateWithin(dirPath, userData)
    if (fsWatchers[resolved]) return
    try {
      const watcher = watch(resolved, () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) win.webContents.send('fs-changed', 'change')
      })
      fsWatchers[resolved] = watcher
    } catch (e) { console.warn('[watchDirectory] Failed to watch:', resolved, e.message) }
  })
}

export function dispose() {
  for (const watcher of Object.values(fsWatchers)) {
    try { watcher.close() } catch (e) { console.warn('[dispose] Failed to close watcher:', e.message) }
  }
  fsWatchers = {}
}
