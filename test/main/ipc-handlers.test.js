import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock electron before importing
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  app: {
    getPath: vi.fn(() => '/tmp/test-userdata'),
    getVersion: vi.fn(() => '1.0.0'),
    requestSingleInstanceLock: vi.fn(() => true),
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn(),
    commandLine: { appendSwitch: vi.fn() },
    exit: vi.fn(),
  },
  BrowserWindow: Object.assign(vi.fn(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    show: vi.fn(),
    isDestroyed: vi.fn(() => false),
    setFullScreen: vi.fn(),
    isFullScreen: vi.fn(() => false),
    webContents: {
      on: vi.fn(),
      send: vi.fn(),
      getURL: vi.fn(),
      setWindowOpenHandler: vi.fn(),
    },
    once: vi.fn(),
  })), {
    getAllWindows: vi.fn(() => []),
  }),
  shell: { openPath: vi.fn(), openExternal: vi.fn() },
  screen: {
    getAllDisplays: vi.fn(() => [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }]),
    getPrimaryDisplay: vi.fn(() => ({ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1080 } })),
  },
  clipboard: { readText: vi.fn(), writeText: vi.fn() },
  globalShortcut: { register: vi.fn(), unregister: vi.fn(), unregisterAll: vi.fn() },
  dialog: { showErrorBox: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
  net: { fetch: vi.fn() },
}))

const mockLstatSync = vi.fn()
const mockReaddirSync = vi.fn()
const mockExistsSync = vi.fn(() => true)
const mockMkdirSync = vi.fn()
const mockReadFileSync = vi.fn(() => '{}')
const mockWriteFileSync = vi.fn()
const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockWatch = vi.fn()

vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  mkdirSync: (...args) => mockMkdirSync(...args),
  readdirSync: (...args) => mockReaddirSync(...args),
  readFileSync: (...args) => mockReadFileSync(...args),
  writeFileSync: (...args) => mockWriteFileSync(...args),
  lstatSync: (...args) => mockLstatSync(...args),
  readFile: (...args) => mockReadFile(...args),
  writeFile: (...args) => mockWriteFile(...args),
  watch: (...args) => mockWatch(...args),
}))

vi.mock('path', async () => {
  const actual = await vi.importActual('path')
  return actual
})

vi.mock('url', async () => {
  const actual = await vi.importActual('url')
  return actual
})

vi.mock('which', () => ({ default: vi.fn(() => Promise.resolve('/bin/bash')) }))
vi.mock('shell-env', () => ({ default: vi.fn(() => Promise.resolve({})) }))
vi.mock('systeminformation', () => ({
  default: {
    cpu: vi.fn(), currentLoad: vi.fn(), mem: vi.fn(),
    cpuTemperature: vi.fn(), processes: vi.fn(), battery: vi.fn(),
    networkInterfaces: vi.fn(), networkStats: vi.fn(),
    blockDevices: vi.fn(), fsSize: vi.fn(),
  },
}))
vi.mock('../../src/main/terminal.js', () => ({ TerminalSession: vi.fn() }))

import { ipcMain } from 'electron'

/**
 * Helper to extract the handler registered for a given channel.
 */
function getHandler(channel) {
  const call = ipcMain.handle.mock.calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`No handler registered for channel: ${channel}`)
  return call[1]
}

async function loadModule() {
  await import('../../src/main/index.js')
}

describe('IPC Handlers', () => {
  const originalWarn = console.warn
  let uncaughtListenerCount = 0
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.setMaxListeners(20)
    uncaughtListenerCount = process.listenerCount('uncaughtException')

    // Replace console.warn to suppress vitest internal warnings
    // We restore it in afterEach
    console.warn = vi.fn()

    // Default fs mock behaviour
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('{}')
    mockReaddirSync.mockReturnValue([])
    mockLstatSync.mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
      isSymbolicLink: () => false,
      size: 42,
      mtime: new Date('2024-01-15T10:30:00Z'),
    })
  })

  afterEach(() => {
    // Trim uncaughtException listeners added by module re-import
    while (process.listenerCount('uncaughtException') > uncaughtListenerCount) {
      process.removeListener('uncaughtException', process.listeners('uncaughtException').pop())
    }
    console.warn = originalWarn
  })

  describe('stat handler', () => {
    it('returns null when filePath is null', async () => {
      await loadModule()
      const stat = getHandler('stat')
      const result = await stat({}, null)
      expect(result).toBeNull()
    })

    it('returns null when filePath is undefined', async () => {
      await loadModule()
      const stat = getHandler('stat')
      const result = await stat({}, undefined)
      expect(result).toBeNull()
    })

    it('returns null when filePath is empty string', async () => {
      await loadModule()
      const stat = getHandler('stat')
      const result = await stat({}, '')
      expect(result).toBeNull()
    })

    it('returns file info object for a valid file', async () => {
      const mtimeDate = new Date('2024-01-15T10:30:00Z')
      mockLstatSync.mockReturnValue({
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
        size: 1234,
        mtime: mtimeDate,
      })

      await loadModule()
      const stat = getHandler('stat')
      const result = await stat({}, '/some/file.txt')

      expect(result).toEqual({
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        size: 1234,
        mtime: mtimeDate.getTime(),
      })
      expect(mockLstatSync).toHaveBeenCalledWith('/some/file.txt')
    })

    it('returns null for ENOENT without logging a warning', async () => {
      const err = Object.assign(new Error('not found'), { code: 'ENOENT' })
      mockLstatSync.mockImplementation(function () { throw err })

      await loadModule()
      // Reset the warn mock after module load to clear vitest internal noise
      console.warn.mockClear()
      const stat = getHandler('stat')
      const result = await stat({}, '/nonexistent')

      expect(result).toBeNull()
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('returns null for EPERM and logs a console.warn', async () => {
      const err = Object.assign(new Error('permission denied'), { code: 'EPERM' })
      mockLstatSync.mockImplementation(function () { throw err })

      await loadModule()
      console.warn.mockClear()
      const stat = getHandler('stat')
      const result = await stat({}, '/forbidden')

      expect(result).toBeNull()
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('EPERM'),
        '/forbidden',
      )
    })

    it('returns null for EBUSY without logging a warning', async () => {
      const err = Object.assign(new Error('busy'), { code: 'EBUSY' })
      mockLstatSync.mockImplementation(function () { throw err })

      await loadModule()
      console.warn.mockClear()
      const stat = getHandler('stat')
      const result = await stat({}, '/dev/sda1')

      expect(result).toBeNull()
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('re-throws unknown errors (e.g. EACCES)', async () => {
      const err = Object.assign(new Error('access denied'), { code: 'EACCES' })
      mockLstatSync.mockImplementation(function () { throw err })

      await loadModule()
      const stat = getHandler('stat')

      await expect(stat({}, '/some/path')).rejects.toThrow('access denied')
    })
  })

  describe('readdir handler', () => {

    it('returns empty array when dirPath is null', async () => {
      await loadModule()
      const readdir = getHandler('readdir')
      const result = await readdir({}, null)
      expect(result).toEqual([])
    })

    it('returns empty array when dirPath is undefined', async () => {
      await loadModule()
      const readdir = getHandler('readdir')
      const result = await readdir({}, undefined)
      expect(result).toEqual([])
    })

    it('returns empty array when dirPath is empty string', async () => {
      await loadModule()
      const readdir = getHandler('readdir')
      const result = await readdir({}, '')
      expect(result).toEqual([])
    })
    it('returns directory listing for valid path', async () => {
      mockReaddirSync.mockReturnValue(['a.txt', 'b.js', 'subdir'])

      await loadModule()
      const readdir = getHandler('readdir')
      const result = await readdir({}, '/some/dir')

      expect(result).toEqual(['a.txt', 'b.js', 'subdir'])
      expect(mockReaddirSync).toHaveBeenCalledWith('/some/dir')
    })

    it('returns empty array for ENOENT', async () => {
      await loadModule()
      const readdir = getHandler('readdir')

      const err = Object.assign(new Error('not found'), { code: 'ENOENT' })
      mockReaddirSync.mockImplementation(function () { throw err })

      const result = await readdir({}, '/nonexistent')
      expect(result).toEqual([])
    })

    it('returns empty array for EBUSY without logging a warning', async () => {
      await loadModule()
      console.warn.mockClear()
      const readdir = getHandler('readdir')

      const err = Object.assign(new Error('busy'), { code: 'EBUSY' })
      mockReaddirSync.mockImplementation(function () { throw err })

      const result = await readdir({}, '/dev/sda1')
      expect(result).toEqual([])
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('returns empty array for EPERM and logs a console.warn', async () => {
      await loadModule()
      console.warn.mockClear()
      const readdir = getHandler('readdir')

      const err = Object.assign(new Error('permission denied'), { code: 'EPERM' })
      mockReaddirSync.mockImplementation(function () { throw err })

      const result = await readdir({}, '/forbidden')
      expect(result).toEqual([])
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('EPERM'),
        '/forbidden',
      )
    })

    it('re-throws unknown errors', async () => {
      await loadModule()
      const readdir = getHandler('readdir')

      const err = Object.assign(new Error('weird error'), { code: 'EIO' })
      mockReaddirSync.mockImplementation(function () { throw err })

      await expect(readdir({}, '/some/path')).rejects.toThrow('weird error')
    })
  })
})
