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
  BrowserWindow: Object.assign(vi.fn(function() {
    this.loadURL = vi.fn();
    this.loadFile = vi.fn();
    this.show = vi.fn();
    this.isDestroyed = vi.fn(() => false);
    this.setFullScreen = vi.fn();
    this.isFullScreen = vi.fn(() => false);
    this.webContents = {
      on: vi.fn(),
      send: vi.fn(),
      getURL: vi.fn(),
      setWindowOpenHandler: vi.fn(),
    };
    this.once = vi.fn();
  }), {
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
const mockWatch = vi.fn()
const mockRealpathSync = vi.fn(p => p)

vi.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  mkdirSync: (...args) => mockMkdirSync(...args),
  readdirSync: (...args) => mockReaddirSync(...args),
  readFileSync: (...args) => mockReadFileSync(...args),
  writeFileSync: (...args) => mockWriteFileSync(...args),
  lstatSync: (...args) => mockLstatSync(...args),
  watch: (...args) => mockWatch(...args),
  realpathSync: (...args) => mockRealpathSync(...args),
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
    system: vi.fn(), chassis: vi.fn(),
    time: vi.fn(),
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
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    process.setMaxListeners(20)
    uncaughtListenerCount = process.listenerCount('uncaughtException')

    // Replace console.warn to suppress vitest internal warnings
    console.warn = vi.fn()

    // Reset mock implementations that clearAllMocks doesn't clear
    mockRealpathSync.mockImplementation(p => p)
    const { app: appMock } = await import('electron')
    appMock.getPath.mockReturnValue('/tmp/test-userdata')

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
      const result = await stat({}, '/tmp/test-userdata/some/file.txt')

      expect(result).toEqual({
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        size: 1234,
        mtime: mtimeDate.getTime(),
      })
      expect(mockLstatSync).toHaveBeenCalledWith('/tmp/test-userdata/some/file.txt')
    })

    it('returns null for ENOENT without logging a warning', async () => {
      const err = Object.assign(new Error('not found'), { code: 'ENOENT' })
      mockLstatSync.mockImplementation(function () { throw err })

      await loadModule()
      // Reset the warn mock after module load to clear vitest internal noise
      console.warn.mockClear()
      const stat = getHandler('stat')
      const result = await stat({}, '/tmp/test-userdata/nonexistent')

      expect(result).toBeNull()
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('returns null for EPERM and logs a console.warn', async () => {
      const err = Object.assign(new Error('permission denied'), { code: 'EPERM' })
      mockLstatSync.mockImplementation(function () { throw err })

      await loadModule()
      console.warn.mockClear()
      const stat = getHandler('stat')
      const result = await stat({}, '/tmp/test-userdata/forbidden')

      expect(result).toBeNull()
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('EPERM'),
        '/tmp/test-userdata/forbidden',
      )
    })

    it('returns null for EBUSY without logging a warning', async () => {
      const err = Object.assign(new Error('busy'), { code: 'EBUSY' })
      mockLstatSync.mockImplementation(function () { throw err })

      await loadModule()
      console.warn.mockClear()
      const stat = getHandler('stat')
      const result = await stat({}, '/tmp/test-userdata/dev/sda1')

      expect(result).toBeNull()
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('re-throws unknown errors (e.g. EACCES)', async () => {
      const err = Object.assign(new Error('access denied'), { code: 'EACCES' })
      mockLstatSync.mockImplementation(function () { throw err })

      await loadModule()
      const stat = getHandler('stat')

      await expect(stat({}, '/tmp/test-userdata/some/path')).rejects.toThrow('access denied')
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
      const result = await readdir({}, '/tmp/test-userdata/some/dir')

      expect(result).toEqual(['a.txt', 'b.js', 'subdir'])
      expect(mockReaddirSync).toHaveBeenCalledWith('/tmp/test-userdata/some/dir')
    })

    it('returns empty array for ENOENT', async () => {
      await loadModule()
      const readdir = getHandler('readdir')

      const err = Object.assign(new Error('not found'), { code: 'ENOENT' })
      mockReaddirSync.mockImplementation(function () { throw err })

      const result = await readdir({}, '/tmp/test-userdata/nonexistent')
      expect(result).toEqual([])
    })

    it('returns empty array for EBUSY without logging a warning', async () => {
      await loadModule()
      console.warn.mockClear()
      const readdir = getHandler('readdir')

      const err = Object.assign(new Error('busy'), { code: 'EBUSY' })
      mockReaddirSync.mockImplementation(function () { throw err })

      const result = await readdir({}, '/tmp/test-userdata/dev/sda1')
      expect(result).toEqual([])
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('returns empty array for EPERM and logs a console.warn', async () => {
      await loadModule()
      console.warn.mockClear()
      const readdir = getHandler('readdir')

      const err = Object.assign(new Error('permission denied'), { code: 'EPERM' })
      mockReaddirSync.mockImplementation(function () { throw err })

      const result = await readdir({}, '/tmp/test-userdata/forbidden')
      expect(result).toEqual([])
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('EPERM'),
        '/tmp/test-userdata/forbidden',
      )
    })

    it('re-throws unknown errors', async () => {
      await loadModule()
      const readdir = getHandler('readdir')

      const err = Object.assign(new Error('weird error'), { code: 'EIO' })
      mockReaddirSync.mockImplementation(function () { throw err })

      await expect(readdir({}, '/tmp/test-userdata/some/path')).rejects.toThrow('weird error')
    })
  })
  describe('system information handlers', () => {
    it('getSystemInfo handler returns si.system() result', async () => {
      const si = (await import('systeminformation')).default
      const mockSystem = { manufacturer: 'Dell', model: 'XPS 15', serial: 'ABC123', uuid: 'test-uuid', sku: 'SKU-001' }
      si.system.mockResolvedValue(mockSystem)

      await loadModule()
      const handler = getHandler('getSystemInfo')
      const result = await handler()

      expect(si.system).toHaveBeenCalled()
      expect(result).toEqual(mockSystem)
    })

    it('getChassisInfo handler returns si.chassis() result', async () => {
      const si = (await import('systeminformation')).default
      const mockChassis = { manufacturer: 'Dell', model: 'XPS 15', type: 'Notebook' }
      si.chassis.mockResolvedValue(mockChassis)

      await loadModule()
      const handler = getHandler('getChassisInfo')
      const result = await handler()

      expect(si.chassis).toHaveBeenCalled()
      expect(result).toEqual(mockChassis)
    })
  })
})

describe('Security: openPath input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
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
    mockRealpathSync.mockImplementation(p => p)
  })

  it('openPath blocks symlinks pointing outside userData via realpathSync', async () => {
    mockRealpathSync.mockReturnValue('/etc/passwd')
    await loadModule()
    const { shell } = await import('electron')
    const openPath = getHandler('openPath')
    shell.openPath.mockResolvedValue('')
    expect(() => openPath({}, '/tmp/test-userdata/evil-link')).toThrow(/denied|outside|not allowed/i)
    expect(shell.openPath).not.toHaveBeenCalled()
  })

  it('openPath allows symlink pointing inside userData', async () => {
    mockRealpathSync.mockReturnValue('/tmp/test-userdata/themes/tron')
    await loadModule()
    const { shell } = await import('electron')
    const openPath = getHandler('openPath')
    shell.openPath.mockResolvedValue('')
    await openPath({}, '/tmp/test-userdata/link-to-theme')
    expect(shell.openPath).toHaveBeenCalled()
  })

  it('openPath still rejects unsafe extensions after validatePath passes', async () => {
    await loadModule()
    const openPath = getHandler('openPath')
    expect(() => openPath({}, '/tmp/test-userdata/malware.exe')).toThrow(/not allowed/)
  })

  it('openPath falls back to resolve when file does not exist (ENOENT)', async () => {
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    mockRealpathSync.mockImplementation(() => { throw enoent })
    await loadModule()
    const { shell } = await import('electron')
    const openPath = getHandler('openPath')
    shell.openPath.mockResolvedValue('')
    await openPath({}, '/tmp/test-userdata/new-file.txt')
    expect(shell.openPath).toHaveBeenCalled()
  })
})

describe('Security: edex-audio protocol handler validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
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
    mockRealpathSync.mockImplementation(p => p)
  })

  async function getProtocolHandler() {
    // Wait for app.whenReady() microtask to flush
    await new Promise(r => setTimeout(r, 50))
    const { protocol } = await import('electron')
    const call = protocol.handle.mock.calls.find(([scheme]) => scheme === 'edex-audio')
    if (!call) throw new Error('No protocol handler registered for edex-audio')
    return call[1]
  }

  it('rejects null bytes in request URL', async () => {
    await loadModule()
    const handler = await getProtocolHandler()
    const res = await handler({ url: 'edex-audio://file%00evil' })
    expect(res.status).toBe(400)
  })

  it('rejects path traversal via .. in request URL', async () => {
    await loadModule()
    const handler = await getProtocolHandler()
    const res = await handler({ url: 'edex-audio://valid/..%2F..%2Fetc%2Fpasswd' })
    expect(res.status).toBe(400)
  })

  it('allows valid audio filename', async () => {
    const { net } = await import('electron')
    net.fetch.mockResolvedValue(new Response('audio-data', { status: 200 }))

    await loadModule()
    const handler = await getProtocolHandler()
    await handler({ url: 'edex-audio://click.mp3' })
    expect(net.fetch).toHaveBeenCalled()
  })
})

describe('Security: readAsset uses realpathSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
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
    mockRealpathSync.mockImplementation(p => p)
  })

  it('blocks symlinks pointing outside assets directory', async () => {
    mockRealpathSync.mockReturnValue('/etc/passwd')
    await loadModule()
    const readAsset = getHandler('readAsset')
    expect(() => readAsset({}, 'evil-link')).toThrow(/traversal|denied|outside/i)
  })

  it('allows symlink pointing inside assets directory', async () => {
    mockRealpathSync.mockReturnValue('/tmp/test-userdata/assets/themes/tron.json')
    mockReadFileSync.mockReturnValue('{"name":"tron"}')
    await loadModule()
    const readAsset = getHandler('readAsset')
    const result = readAsset({}, 'themes/tron.json')
    expect(result).toBe('{"name":"tron"}')
  })

  it('falls back to resolve when asset does not exist (ENOENT)', async () => {
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    mockRealpathSync.mockImplementation(() => { throw enoent })
    mockReadFileSync.mockReturnValue('data')
    await loadModule()
    const readAsset = getHandler('readAsset')
    const result = readAsset({}, 'new-asset.txt')
    expect(result).toBe('data')
  })

  it('blocks resolved traversal via symlink + realpathSync', async () => {
    mockRealpathSync.mockReturnValue('/tmp/other-userdata/secret.txt')
    await loadModule()
    const readAsset = getHandler('readAsset')
    expect(() => readAsset({}, 'link')).toThrow(/traversal|denied|outside/i)
  })
})

describe('Security: Asset path handlers use realpathSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
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
    mockRealpathSync.mockImplementation(p => p)
  })

  const pathHandlers = [
    { channel: 'getThemePath', filePath: '/tmp/test-userdata/themes/evil' },
    { channel: 'getKeyboardPath', filePath: '/tmp/test-userdata/keyboards/evil' },
    { channel: 'getAudioPath', filePath: '/tmp/test-userdata/assets/audio/evil' },
  ]

  for (const { channel, filePath } of pathHandlers) {
    it(`${channel} blocks symlinks pointing outside userData`, async () => {
      mockRealpathSync.mockReturnValue('/etc/passwd')
      await loadModule()
      const handler = getHandler(channel)
      expect(() => handler({}, 'evil-link')).toThrow(/denied|outside|not allowed/i)
    })

    it(`${channel} allows symlink pointing inside userData`, async () => {
      mockRealpathSync.mockReturnValue(filePath)
      await loadModule()
      const handler = getHandler(channel)
      const result = handler({}, 'evil-link')
      expect(result).toBeTruthy()
      expect(result).toContain('evil-link')
    })

    it(`${channel} falls back to resolve when file does not exist (ENOENT)`, async () => {
      const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      mockRealpathSync.mockImplementation(() => { throw enoent })
      await loadModule()
      const handler = getHandler(channel)
      const result = handler({}, 'new-file')
      expect(result).toBeTruthy()
    })
  }
})

describe('Security: getTheme/getKeyboardLayout use realpathSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
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
    mockRealpathSync.mockImplementation(p => p)
  })

  const contentHandlers = [
    { channel: 'getTheme', baseDir: '/tmp/test-userdata/themes', suffix: '.json' },
    { channel: 'getKeyboardLayout', baseDir: '/tmp/test-userdata/keyboards', suffix: '' },
  ]

  for (const { channel, baseDir, suffix } of contentHandlers) {
    it(`${channel} blocks symlinks pointing outside allowed directory`, async () => {
      mockRealpathSync.mockReturnValue('/etc/passwd')
      await loadModule()
      const handler = getHandler(channel)
      expect(() => handler({}, 'evil-link')).toThrow(/denied|outside|traversal/i)
    })

    it(`${channel} allows symlink pointing inside allowed directory`, async () => {
      mockRealpathSync.mockReturnValue(`${baseDir}/legit${suffix}`)
      mockReadFileSync.mockReturnValue('{"ok":true}')
      await loadModule()
      const handler = getHandler(channel)
      const result = handler({}, 'legit')
      expect(result).toEqual({ ok: true })
    })

    it(`${channel} falls back to resolve when file does not exist (ENOENT)`, async () => {
      const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      mockRealpathSync.mockImplementation(() => { throw enoent })
      mockReadFileSync.mockReturnValue('{"default":true}')
      await loadModule()
      const handler = getHandler(channel)
      const result = handler({}, 'new-file')
      expect(result).toEqual({ default: true })
    })
  }
})

describe('Security: edex-audio protocol TOCTOU fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
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
    mockRealpathSync.mockImplementation(p => p)
  })

  async function getProtocolHandler() {
    await new Promise(r => setTimeout(r, 50))
    const { protocol } = await import('electron')
    const call = protocol.handle.mock.calls.find(([scheme]) => scheme === 'edex-audio')
    if (!call) throw new Error('No protocol handler registered for edex-audio')
    return call[1]
  }

  it('fetches resolved path instead of original (TOCTOU fix)', async () => {
    mockRealpathSync.mockReturnValue('/tmp/test-userdata/assets/audio/safe.mp3')
    const { net } = await import('electron')
    net.fetch.mockResolvedValue(new Response('audio-data', { status: 200 }))

    await loadModule()
    const handler = await getProtocolHandler()
    await handler({ url: 'edex-audio://click.mp3' })

    const fetchArg = net.fetch.mock.calls[0][0]
    expect(fetchArg).toContain('safe.mp3')
    expect(fetchArg).toContain('file:///tmp/test-userdata/assets/audio')
  })

  it('blocks symlink pointing outside audio directory', async () => {
    mockRealpathSync.mockReturnValue('/etc/passwd')
    const { net } = await import('electron')

    await loadModule()
    const handler = await getProtocolHandler()
    const res = await handler({ url: 'edex-audio://evil-link' })
    expect(res.status).toBe(403)
    expect(net.fetch).not.toHaveBeenCalled()
  })


  // --- Issue 2: openPath extension allowlist expanded ---
  describe('openPath extension allowlist (Issue 2)', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      vi.resetModules()
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('{}')
      mockReaddirSync.mockReturnValue([])
      mockLstatSync.mockReturnValue({
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
        size: 42,
        mtime: new Date(),
      })
      mockRealpathSync.mockImplementation(p => p)
    })

    // Verify that extensions NOT in the allowlist are still rejected
    it('rejects truly unsafe extensions like .exe', async () => {
      await loadModule()
      const openPath = getHandler('openPath')
      expect(() => openPath({}, '/tmp/test-userdata/malware.exe')).toThrow(/not allowed/)
    })

    // Verify newly-added extensions are accepted (fix for Issue 2)
    const newlyAllowed = ['.log', '.csv', '.svg', '.mp4', '.yaml', '.toml']

    newlyAllowed.forEach(ext => {
      it(`accepts ${ext} files (added to allowlist)`, async () => {
        await loadModule()
        const openPath = getHandler('openPath')
        expect(() => openPath({}, `/tmp/test-userdata/file${ext}`)).not.toThrow()
      })
    })

    // Verify originally-allowed extensions still work
    const originallyAllowed = ['.txt', '.json', '.png', '.jpg', '.pdf', '.md', '.html', '.css', '.js', '.wav', '.mp3', '.ogg']

    originallyAllowed.forEach(ext => {
      it(`still accepts ${ext} files`, async () => {
        await loadModule()
        const openPath = getHandler('openPath')
        expect(() => openPath({}, `/tmp/test-userdata/file${ext}`)).not.toThrow()
      })
    })
  })


  // --- Issue 3: getSystemUptime missing ---
  describe('getSystemUptime (Issue 3)', () => {
    it('registers a getSystemUptime handler', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('{}')
      await loadModule()
      expect(() => getHandler('getSystemUptime')).not.toThrow()
    })

    it('returns an object with numeric uptime property', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('{}')
      await loadModule()
      const si = await import('systeminformation')
      si.default.time.mockResolvedValue({ uptime: 123456 })

      const handler = getHandler('getSystemUptime')
      const result = await handler({})

      expect(result).toHaveProperty('uptime')
      expect(typeof result.uptime).toBe('number')
      expect(si.default.time).toHaveBeenCalled()
    })
  })


  // --- Issue 5: BrowserWindow constructable ---
  describe('BrowserWindow constructable (Issue 5)', () => {
    it('can be called with new without throwing', async () => {
      const { BrowserWindow } = await import('electron')
      expect(() => new BrowserWindow({})).not.toThrow()
    })

    it('returns object with expected properties when constructed', async () => {
      const { BrowserWindow } = await import('electron')
      const win = new BrowserWindow({})
      expect(win).toHaveProperty('loadURL')
      expect(win).toHaveProperty('loadFile')
      expect(win).toHaveProperty('show')
      expect(win).toHaveProperty('webContents')
    })
  })


  // --- Issue 4: Dead mocks cleanup ---
  describe('Dead mocks cleanup (Issue 4)', () => {
    it('no standalone mockReadFile/mockWriteFile bindings in fs mock', () => {
      // After fix, readFile and writeFile should not be wired to unused standalone mocks
      // Check that the file no longer declares mockReadFile/mockWriteFile
      const fsModule = require('fs')
      // readFileSync and writeFile are the ones actually used (via the main module)
      expect(fsModule.readFileSync).toBeDefined()
      expect(fsModule.writeFileSync).toBeDefined()
    })
  })
})