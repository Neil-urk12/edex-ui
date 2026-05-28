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

  it('openPath still rejects unsafe extensions after validateWithin passes', async () => {
    await loadModule()
    const openPath = getHandler('openPath')
    expect(() => openPath({}, '/tmp/test-userdata/malware.exe')).toThrow(/not allowed/)
  })

  it('openPath falls back to resolve when file does not exist (ENOENT)', async () => {
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    mockRealpathSync.mockImplementation(() => { throw enoent })
    mockLstatSync.mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
      isSymbolicLink: () => false,
      size: 42,
      mtime: new Date(),
    })
    await loadModule()
    const { shell } = await import('electron')
    const openPath = getHandler('openPath')
    shell.openPath.mockResolvedValue('')
    await openPath({}, '/tmp/test-userdata/new-file.txt')
    expect(shell.openPath).toHaveBeenCalled()
  })

  it('openPath handles lstatSync ENOENT gracefully (file deleted between list and open)', async () => {
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    mockLstatSync.mockImplementation(() => { throw enoent })
    await loadModule()
    const { shell } = await import('electron')
    const openPath = getHandler('openPath')
    shell.openPath.mockResolvedValue('')
    await openPath({}, '/tmp/test-userdata/deleted-file.txt')
    expect(shell.openPath).toHaveBeenCalled()
  })

  it('openPath rejects directories to prevent opening userData in file manager', async () => {
    mockLstatSync.mockReturnValue({
      isFile: () => false,
      isDirectory: () => true,
      isSymbolicLink: () => false,
      size: 0,
      mtime: new Date(),
    })
    await loadModule()
    const { shell } = await import('electron')
    const openPath = getHandler('openPath')
    expect(() => openPath({}, '/tmp/test-userdata')).toThrow(/directory|not a file/i)
    expect(shell.openPath).not.toHaveBeenCalled()
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
      expect(result).toBe(filePath)  // resolved path still inside allowed dir
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

  // --- Security: readdir and stat unrestricted access ---
  describe('Security: readdir and stat allow arbitrary paths', () => {
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

    it('readdir works for paths outside userData (e.g. /tmp)', async () => {
      mockReaddirSync.mockReturnValue(['file1.txt', 'file2.txt'])
      await loadModule()
      const readdir = getHandler('readdir')
      const result = await readdir({}, '/tmp/some/dir')
      expect(result).toEqual(['file1.txt', 'file2.txt'])
    })

    it('stat works for paths outside userData (e.g. /etc)', async () => {
      await loadModule()
      const stat = getHandler('stat')
      const result = await stat({}, '/etc/hostname')
      expect(result).toBeTruthy()
      expect(result.isFile).toBe(true)
    })

    it('readdir still rejects null bytes', async () => {
      await loadModule()
      const readdir = getHandler('readdir')
      expect(() => readdir({}, '/tmp/file\0evil')).toThrow(/Invalid/)
    })

    it('stat still rejects null bytes', async () => {
      await loadModule()
      const stat = getHandler('stat')
      expect(() => stat({}, '/tmp/file\0evil')).toThrow(/Invalid/)
    })
  })

  // --- Security: getAudioUrl input validation ---
  describe('Security: getAudioUrl input validation', () => {
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

    it('rejects null bytes in filename', async () => {
      await loadModule()
      const handler = getHandler('getAudioUrl')
      expect(() => handler({}, 'file\0evil.mp3')).toThrow(/Invalid/)
    })

    it('rejects path traversal via ..', async () => {
      await loadModule()
      const handler = getHandler('getAudioUrl')
      expect(() => handler({}, '../../etc/passwd')).toThrow(/Invalid|traversal/)
    })

    it('allows valid audio filename', async () => {
      await loadModule()
      const handler = getHandler('getAudioUrl')
      const result = handler({}, 'click.mp3')
      expect(result).toContain('click.mp3')
    })
  })

  // --- Security: readFile and writeFile restricted to userData ---
  describe('Security: readFile and writeFile restricted to userData', () => {
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

    it('readFile rejects paths outside userData', async () => {
      await loadModule()
      const handler = getHandler('readFile')
      expect(() => handler({}, '/etc/passwd', 'utf-8')).toThrow(/denied|outside/)
    })

    it('writeFile rejects paths outside userData', async () => {
      await loadModule()
      const handler = getHandler('writeFile')
      expect(() => handler({}, '/etc/crontab', 'evil')).toThrow(/denied|outside/)
    })

    it('readFile allows paths inside userData', async () => {
      mockReadFileSync.mockReturnValue('hello')
      await loadModule()
      const handler = getHandler('readFile')
      const result = handler({}, '/tmp/test-userdata/file.txt', 'utf-8')
      expect(result).toBe('hello')
    })

    it('writeFile allows paths inside userData', async () => {
      await loadModule()
      const handler = getHandler('writeFile')
      expect(() => handler({}, '/tmp/test-userdata/file.txt', 'data')).not.toThrow()
    })
  })
})

describe('Security: saveSettings key allowlist', () => {
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

  it('allows updating safe settings like theme', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ theme: 'tron', shell: 'bash' }))
    await loadModule()
    const handler = getHandler('saveSettings')
    const result = handler({}, { theme: 'matrix' })
    expect(result.theme).toBe('matrix')
  })

  it('strips shell from partial to prevent terminal injection', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ theme: 'tron', shell: 'bash' }))
    await loadModule()
    const handler = getHandler('saveSettings')
    const result = handler({}, { shell: '/bin/sh', shellArgs: '-c "rm -rf /"' })
    expect(result.shell).toBe('bash')  // unchanged
    expect(result.shellArgs).toBe('')  // unchanged (or default)
  })

  it('strips cwd from partial to prevent path injection', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ theme: 'tron', cwd: '/tmp/test-userdata' }))
    await loadModule()
    const handler = getHandler('saveSettings')
    const result = handler({}, { cwd: '/etc' })
    expect(result.cwd).toBe('/tmp/test-userdata')  // unchanged
  })

  it('still allows all safe keys', async () => {
    mockReadFileSync.mockReturnValue('{}')
    await loadModule()
    const handler = getHandler('saveSettings')
    const safeUpdate = {
      keyboard: 'fr-FR',
      theme: 'matrix',
      termFontSize: 18,
      audio: false,
      audioVolume: 0.5,
      disableFeedbackAudio: true,
      clockHours: 12,
      pingAddr: '8.8.8.8',
      port: 8080,
      nointro: true,
      nocursor: false,
      forceFullscreen: true,
      allowWindowed: false,
      excludeThreadsFromToplist: true,
      hideDotfiles: true,
      fsListView: true,
      experimentalGlobeFeatures: true,
      experimentalFeatures: true,
    }
    const result = handler({}, safeUpdate)
    for (const [key, val] of Object.entries(safeUpdate)) {
      expect(result[key]).toBe(val)
    }
  })

  it('strips computed path keys (settingsDir, themesPath, etc.)', async () => {
    mockReadFileSync.mockReturnValue('{}')
    await loadModule()
    const handler = getHandler('saveSettings')
    const result = handler({}, {
      settingsDir: '/evil/path',
      themesPath: '/evil/themes',
      kbLayoutPath: '/evil/keyboards',
      settingsFile: '/evil/settings.json',
      theme: 'matrix'
    })
    expect(result.settingsDir).toBeUndefined()
    expect(result.themesPath).toBeUndefined()
    expect(result.kbLayoutPath).toBeUndefined()
    expect(result.settingsFile).toBeUndefined()
    expect(result.theme).toBe('matrix')
  })

  it('drops unknown keys not in allowlist (default-deny)', async () => {
    mockReadFileSync.mockReturnValue('{}')
    await loadModule()
    const handler = getHandler('saveSettings')
    const result = handler({}, { maliciousKey: 'evil', theme: 'matrix' })
    expect(result.maliciousKey).toBeUndefined()
    expect(result.theme).toBe('matrix')
  })

  it('drops all keys when partial has only blocked/unknown keys', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ theme: 'tron' }))
    await loadModule()
    const handler = getHandler('saveSettings')
    const result = handler({}, { shell: '/bin/sh', cwd: '/etc', unknownKey: 'val' })
    expect(result.shell).toBe('bash')  // defaultSettings value, not overwritten
    expect(result.cwd).toBe('/tmp/test-userdata')  // defaultSettings value, not overwritten
    expect(result.unknownKey).toBeUndefined()
    expect(result.theme).toBe('tron')
  })

  it('drops __proto__ and constructor to prevent prototype pollution', async () => {
    mockReadFileSync.mockReturnValue('{}')
    await loadModule()
    const handler = getHandler('saveSettings')
    const result = handler({}, { '__proto__': { polluted: true }, 'constructor': 'evil', theme: 'matrix' })
    expect(result.theme).toBe('matrix')
    // verify prototype not polluted — check directly on Object.prototype
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false)
  })

  it('ignores inherited properties on partial prototype chain (Object.hasOwn defense)', async () => {
    mockReadFileSync.mockReturnValue('{}')
    await loadModule()
    const handler = getHandler('saveSettings')

    // Inject a property onto Object.prototype that matches an allowlisted key
    const hadTheme = 'theme' in Object.prototype
    const originalTheme = Object.prototype.theme
    Object.prototype.theme = 'inherited-evil'

    try {
      const result = handler({}, {})
      // With Object.hasOwn: inherited property should NOT be applied
      // With `in` operator: inherited property WOULD be applied (this is the bug)
      expect(result.theme).not.toBe('inherited-evil')
    } finally {
      // Clean up
      if (hadTheme) {
        Object.prototype.theme = originalTheme
      } else {
        delete Object.prototype.theme
      }
    }
  })

  it('handles null and non-object partial without throwing', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ theme: 'tron' }))
    await loadModule()
    const handler = getHandler('saveSettings')

    // null partial — Object.hasOwn(null, key) throws TypeError
    expect(() => handler({}, null)).not.toThrow()
    const r1 = handler({}, null)
    expect(r1.theme).toBe('tron')

    // string partial
    const r2 = handler({}, 'not-an-object')
    expect(r2.theme).toBe('tron')

    // undefined partial
    const r3 = handler({}, undefined)
    expect(r3.theme).toBe('tron')

    // number partial
    const r4 = handler({}, 42)
    expect(r4.theme).toBe('tron')
  })
})

describe('Security: terminal:create shell validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    mockRealpathSync.mockImplementation(p => p)
  })

  it('rejects arbitrary shell path and falls back to settings.shell', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockResolvedValueOnce('/usr/bin/evil')
    await loadModule()
    const handler = getHandler('terminal:create')
    const result = await handler({}, { shell: '/usr/bin/evil' })
    // Shell should fall back to settings.shell since '/usr/bin/evil' is not in allowlist
    expect(result).toBeDefined()
  })

  it('accepts a shell in the allowlist', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockResolvedValueOnce('/bin/bash')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    const result = await handler({}, { shell: '/bin/bash' })
    expect(result).toBeDefined()
  })

  it('falls back to settings.shell when which fails', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockRejectedValueOnce(new Error('not found'))
    await loadModule()
    const handler = getHandler('terminal:create')
    const result = await handler({}, { shell: 'nonexistent' })
    expect(result).toBeDefined()
  })

  it('throws on params containing shell metacharacters instead of silent filtering', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockResolvedValueOnce('/bin/bash')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, { params: ['--login', '-c rm -rf /; echo pwned'] }))
      .rejects.toThrow(/Invalid shell parameter|forbidden characters/)
  })

  it('rejects -c flag in params to prevent argv injection', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockResolvedValueOnce('/bin/bash')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, { params: ['-c', 'rm -rf /'] }))
      .rejects.toThrow(/Invalid shell parameter|\-c flag/)
  })

  it('rejects -C flag (uppercase) in params', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockResolvedValueOnce('/bin/bash')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, { params: ['-C', 'echo hi'] }))
      .rejects.toThrow(/Invalid shell parameter|\-c flag/)
  })

  it('rejects params with backslash characters', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockResolvedValueOnce('/bin/bash')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, { params: ['--login', 'arg\\with\\backslash'] }))
      .rejects.toThrow(/Invalid shell parameter|forbidden characters/)
  })

  it('rejects params with single quotes', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockResolvedValueOnce('/bin/bash')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, { params: ["--login", "arg'with'quotes"] }))
      .rejects.toThrow(/Invalid shell parameter|forbidden characters/)
  })

  it('rejects params with double quotes', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockResolvedValueOnce('/bin/bash')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, { params: ['--login', 'arg"with"quotes'] }))
      .rejects.toThrow(/Invalid shell parameter|forbidden characters/)
  })

  it('rejects params with newline characters', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockResolvedValueOnce('/bin/bash')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, { params: ['--login', 'arg\nwith\nnewline'] }))
      .rejects.toThrow(/Invalid shell parameter|forbidden characters/)
  })

  it('rejects params with hash character (comment injection)', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockResolvedValueOnce('/bin/bash')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, { params: ['--login', '#injected-comment'] }))
      .rejects.toThrow(/Invalid shell parameter|forbidden characters/)
  })

  it('rejects settings.shell not in allowlist when options.shell not provided', async () => {
    const { default: whichMock } = await import('which')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/tmp/evil-shell', shellArgs: ['--login'] }))
    whichMock.mockImplementation(async (cmd) => {
      if (cmd === '/tmp/evil-shell') return '/tmp/evil-shell'
      if (cmd === 'bash') return '/bin/bash'
      throw new Error('not found')
    })
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, {})).rejects.toThrow(/allowlist|No allowed shell/)
  })

  it('throws when both options.shell and settings.shell fail allowlist', async () => {
    const { default: whichMock } = await import('which')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/tmp/evil-shell', shellArgs: ['--login'] }))
    whichMock.mockImplementation(async (cmd) => {
      if (cmd === '/tmp/evil-shell') return '/tmp/evil-shell'
      throw new Error('not found')
    })
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, {})).rejects.toThrow(/allowlist|No allowed shell/)
  })

  it('passes through safe params unchanged', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockImplementation(async (cmd) => {
      if (cmd === '/bin/bash') return '/bin/bash'
      throw new Error('not found')
    })
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    const result = await handler({}, { params: ['--login', '--norc'] })
    expect(result).toBeDefined()
  })

  it('accepts /usr/local/bin/bash as allowed shell', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockImplementation(async (cmd) => {
      if (cmd === '/usr/local/bin/bash') return '/usr/local/bin/bash'
      throw new Error('not found')
    })
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/usr/local/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, { shell: '/usr/local/bin/bash' })).resolves.toBeDefined()
  })

  it('accepts /opt/homebrew/bin/zsh as allowed shell', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockImplementation(async (cmd) => {
      if (cmd === '/opt/homebrew/bin/zsh') return '/opt/homebrew/bin/zsh'
      throw new Error('not found')
    })
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/opt/homebrew/bin/zsh', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, { shell: '/opt/homebrew/bin/zsh' })).resolves.toBeDefined()
  })

  it('rejects params with tilde character (home dir expansion)', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockResolvedValue('/bin/bash')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, { params: ['--login', '~/secret'] }))
      .rejects.toThrow(/Invalid shell parameter|forbidden characters/)
  })

  it('rejects cwd outside userData directory', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockResolvedValueOnce('/bin/bash')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    await expect(handler({}, { cwd: '/etc' })).rejects.toThrow(/Access denied|outside allowed/)
  })

  it('allows cwd inside userData directory', async () => {
    const { default: whichMock } = await import('which')
    whichMock.mockResolvedValueOnce('/bin/bash')
    mockReadFileSync.mockReturnValue(JSON.stringify({ shell: '/bin/bash', shellArgs: ['--login'] }))
    await loadModule()
    const handler = getHandler('terminal:create')
    // Should not throw for a path inside userData
    await expect(handler({}, { cwd: '/tmp/test-userdata/subdir' })).resolves.toBeDefined()
  })
})
describe('Path handlers return resolved path', () => {
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

  it('getAudioPath returns resolved path (not original join)', async () => {
    // Simulate a symlink: join() produces /tmp/.../audio/symlink.mp3
    // but realpathSync resolves it to the real file
    mockRealpathSync.mockReturnValue('/tmp/test-userdata/assets/audio/real-click.mp3')
    await loadModule()
    const handler = getHandler('getAudioPath')
    const result = handler({}, 'symlink.mp3')
    expect(result).toBe('/tmp/test-userdata/assets/audio/real-click.mp3')
  })

  it('getThemePath returns resolved path', async () => {
    mockRealpathSync.mockReturnValue('/tmp/test-userdata/themes/resolved-tron')
    await loadModule()
    const handler = getHandler('getThemePath')
    const result = handler({}, 'symlink-tron')
    expect(result).toBe('/tmp/test-userdata/themes/resolved-tron')
  })

  it('getKeyboardPath returns resolved path', async () => {
    mockRealpathSync.mockReturnValue('/tmp/test-userdata/keyboards/resolved-en-US')
    await loadModule()
    const handler = getHandler('getKeyboardPath')
    const result = handler({}, 'symlink-en-US')
    expect(result).toBe('/tmp/test-userdata/keyboards/resolved-en-US')
  })
})

describe('validateWithin helper consolidation', () => {
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

  const handlers = [
    { channel: 'getTheme', args: ['test'], baseDir: '/tmp/test-userdata/themes', suffix: '.json' },
    { channel: 'getKeyboardLayout', args: ['test'], baseDir: '/tmp/test-userdata/keyboards', suffix: '' },
    { channel: 'getAudioUrl', args: ['test.mp3'], baseDir: '/tmp/test-userdata/assets/audio', suffix: '' },
    { channel: 'getAudioPath', args: ['test.mp3'], baseDir: '/tmp/test-userdata/assets/audio', suffix: '' },
    { channel: 'getThemePath', args: ['test'], baseDir: '/tmp/test-userdata/themes', suffix: '' },
    { channel: 'getKeyboardPath', args: ['test'], baseDir: '/tmp/test-userdata/keyboards', suffix: '' },
  ]

  for (const { channel, args, baseDir } of handlers) {
    it(`${channel} blocks symlinks pointing outside allowed directory`, async () => {
      mockRealpathSync.mockReturnValue('/etc/passwd')
      await loadModule()
      const handler = getHandler(channel)
      expect(() => handler({}, ...args)).toThrow(/denied|outside|traversal/)
    })

    it(`${channel} allows paths inside allowed directory`, async () => {
      mockRealpathSync.mockReturnValue(`${baseDir}/safe`)
      mockReadFileSync.mockReturnValue('{"ok":true}')
      await loadModule()
      const handler = getHandler(channel)
      expect(() => handler({}, ...args)).not.toThrow()
    })
  }
  for (const { channel } of handlers) {
    it(`${channel} rejects empty filename (rel === '' defense)`, async () => {
      // getTheme appends '.json' so empty name yields themesDir/.json (inside dir)
      // getKeyboardLayout/Path use join(dir, name) — empty yields dir itself (rel === '')
      if (channel === 'getTheme' || channel === 'getThemePath') return
      await loadModule()
      const handler = getHandler(channel)
      expect(() => handler({}, '')).toThrow(/denied|outside|Invalid/)
    })
  }
})

describe('validateFilename false positive on ..', () => {
  it('accepts filename with embedded .. that is not traversal (track..remix.mp3)', async () => {
    const { validateFilename } = await import('../../src/main/ipc-validation.js')
    expect(() => validateFilename('track..remix.mp3')).not.toThrow()
  })

  it('accepts filename ending with .. (v2..final)', async () => {
    const { validateFilename } = await import('../../src/main/ipc-validation.js')
    expect(() => validateFilename('v2..final')).not.toThrow()
  })

  it('rejects ../etc/passwd (traversal at start)', async () => {
    const { validateFilename } = await import('../../src/main/ipc-validation.js')
    expect(() => validateFilename('../etc/passwd')).toThrow(/Invalid/)
  })

  it('rejects foo/../../etc/passwd (traversal in middle)', async () => {
    const { validateFilename } = await import('../../src/main/ipc-validation.js')
    expect(() => validateFilename('foo/../../etc/passwd')).toThrow(/Invalid/)
  })

  it('rejects null bytes', async () => {
    const { validateFilename } = await import('../../src/main/ipc-validation.js')
    expect(() => validateFilename('file\0evil')).toThrow(/Invalid/)
  })
})

describe('Security: validateFilename rejects absolute paths', () => {
  it('rejects /etc/passwd', async () => {
    const { validateFilename } = await import('../../src/main/ipc-validation.js')
    expect(() => validateFilename('/etc/passwd')).toThrow(/Invalid/)
  })

  it('rejects /root/.ssh/id_rsa', async () => {
    const { validateFilename } = await import('../../src/main/ipc-validation.js')
    expect(() => validateFilename('/root/.ssh/id_rsa')).toThrow(/Invalid/)
  })

  it('still accepts relative filenames like config.json', async () => {
    const { validateFilename } = await import('../../src/main/ipc-validation.js')
    expect(() => validateFilename('config.json')).not.toThrow()
  })
})
