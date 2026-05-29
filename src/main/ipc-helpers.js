import { readFileSync, mkdirSync } from 'fs'

/**
 * Send data to the main window's renderer, with null/destroyed guard.
 * Extracted from repeated `if (mainWindow && !mainWindow.isDestroyed()) { ... }` patterns.
 */
export function sendToMainWindow(mainWindow, channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

/**
 * Read and parse a JSON file. Returns `fallback` on any error (missing file, invalid JSON).
 * Logs a warning on errors. Uses utf-8 encoding.
 */
export function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch (err) {
    console.warn('[readJsonFile]', filePath, err.message)
    return fallback
  }
}

/**
 * Create a directory if it doesn't exist. Does not throw on EEXIST.
 * Logs a warning on other errors (e.g. EACCES).
 */
export function ensureDir(dirPath, options) {
  try {
    if (options !== undefined) {
      mkdirSync(dirPath, options)
    } else {
      mkdirSync(dirPath)
    }
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.warn('[ensureDir]', dirPath, err.message)
    }
  }
}
