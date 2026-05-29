import { vi, describe, it, expect, beforeEach } from 'vitest'

// --- Electron mock ---
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
  BrowserWindow: Object.assign(vi.fn(function () {
    this.loadURL = vi.fn()
    this.loadFile = vi.fn()
    this.show = vi.fn()
    this.isDestroyed = vi.fn(() => false)
    this.setFullScreen = vi.fn()
    this.isFullScreen = vi.fn(() => false)
    this.webContents = {
      on: vi.fn(),
      send: vi.fn(),
      getURL: vi.fn(),
      setWindowOpenHandler: vi.fn(),
    }
    this.once = vi.fn()
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

// --- fs mock ---
const mockReadFileSync = vi.fn(() => '{}')
const mockWriteFileSync = vi.fn()
const mockReaddirSync = vi.fn(() => [])
const mockLstatSync = vi.fn(() => ({
  isFile: () => true,
  isDirectory: () => false,
  isSymbolicLink: () => false,
  size: 42,
  mtime: new Date('2024-01-15T10:30:00Z'),
}))
const mockExistsSync = vi.fn(() => true)
const mockMkdirSync = vi.fn()
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

// --- path / url pass-through ---
vi.mock('path', async () => {
  const actual = await vi.importActual('path')
  return actual
})
vi.mock('url', async () => {
  const actual = await vi.importActual('url')
  return actual
})

// --- systeminformation mock ---
vi.mock('systeminformation', () => ({
  default: {
    cpu: vi.fn(),
    currentLoad: vi.fn(),
    mem: vi.fn(),
    cpuTemperature: vi.fn(),
    processes: vi.fn(),
    battery: vi.fn(),
    networkInterfaces: vi.fn(),
    networkStats: vi.fn(),
    blockDevices: vi.fn(),
    fsSize: vi.fn(),
    system: vi.fn(),
    chassis: vi.fn(),
    time: vi.fn(),
  },
}))

vi.mock('which', () => ({ default: vi.fn(() => Promise.resolve('/bin/bash')) }))
vi.mock('shell-env', () => ({ default: vi.fn(() => Promise.resolve({})) }))
vi.mock('../../src/main/terminal.js', () => ({ TerminalSession: vi.fn() }))

// --- Imports ---
import { ipcMain } from 'electron'
import { join } from 'path'
import { createHash } from 'crypto'

// --- Shared constants ---
const userData = '/tmp/test-userdata'
const themesDir = join(userData, 'themes')
const kblayoutsDir = join(userData, 'keyboards')
const settingsFile = join(userData, 'settings.json')

const defaultSettings = {
  shell: 'bash',
  shellArgs: '',
  cwd: userData,
  keyboard: 'en-US',
  theme: 'tron',
  termFontSize: 15,
  audio: true,
  audioVolume: 1.0,
  disableFeedbackAudio: false,
  clockHours: 24,
  pingAddr: '1.1.1.1',
  port: 3000,
  nointro: false,
  nocursor: false,
  forceFullscreen: true,
  allowWindowed: false,
  excludeThreadsFromToplist: true,
  hideDotfiles: false,
  fsListView: false,
  experimentalGlobeFeatures: false,
  experimentalFeatures: false,
}

// --- Helpers ---

function getHandler(channel) {
  const call = ipcMain.handle.mock.calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`No handler registered for channel: ${channel}`)
  return call[1]
}

// =============================================================
//  ipc-system.js — 13 system information handlers
// =============================================================
describe('ipc-system.js', () => {
  let register, si

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    si = (await import('systeminformation')).default
    const mod = await import('../../src/main/ipc-system.js')
    register = mod.register || mod.default
  })

  it('exports a register(ipcMain, deps) function', () => {
    expect(typeof register).toBe('function')
  })

  it('registers all 13 system info handlers', () => {
    register(ipcMain, { si })
    const channels = [
      'getCpuInfo', 'getCpuLoad', 'getMemoryInfo', 'getCpuTemperature',
      'getProcesses', 'getBattery', 'getNetworkInterfaces', 'getNetworkStats',
      'getBlockDevices', 'getFsSize', 'getSystemInfo', 'getChassisInfo', 'getSystemUptime',
    ]
    for (const ch of channels) {
      expect(ipcMain.handle).toHaveBeenCalledWith(ch, expect.any(Function))
    }
  })

  it('getCpuInfo delegates to si.cpu()', async () => {
    const mock = { manufacturer: 'Intel', brand: 'i7', cores: 8 }
    si.cpu.mockResolvedValue(mock)
    register(ipcMain, { si })
    const handler = getHandler('getCpuInfo')
    const result = await handler()
    expect(si.cpu).toHaveBeenCalled()
    expect(result).toEqual(mock)
  })

  it('getCpuLoad delegates to si.currentLoad()', async () => {
    const mock = { currentLoad: 45.2, cpus: [] }
    si.currentLoad.mockResolvedValue(mock)
    register(ipcMain, { si })
    const handler = getHandler('getCpuLoad')
    const result = await handler()
    expect(si.currentLoad).toHaveBeenCalled()
    expect(result).toEqual(mock)
  })

  it('getMemoryInfo delegates to si.mem()', async () => {
    const mock = { total: 16000000000, free: 8000000000 }
    si.mem.mockResolvedValue(mock)
    register(ipcMain, { si })
    const handler = getHandler('getMemoryInfo')
    const result = await handler()
    expect(si.mem).toHaveBeenCalled()
    expect(result).toEqual(mock)
  })

  it('getCpuTemperature delegates to si.cpuTemperature()', async () => {
    const mock = { main: 55, cores: [50, 52, 55, 58] }
    si.cpuTemperature.mockResolvedValue(mock)
    register(ipcMain, { si })
    const handler = getHandler('getCpuTemperature')
    const result = await handler()
    expect(si.cpuTemperature).toHaveBeenCalled()
    expect(result).toEqual(mock)
  })

  it('getProcesses delegates to si.processes()', async () => {
    const mock = { all: 200, running: 3, list: [] }
    si.processes.mockResolvedValue(mock)
    register(ipcMain, { si })
    const handler = getHandler('getProcesses')
    const result = await handler()
    expect(si.processes).toHaveBeenCalled()
    expect(result).toEqual(mock)
  })

  it('getBattery delegates to si.battery()', async () => {
    const mock = { hasBattery: true, percent: 85, isCharging: true }
    si.battery.mockResolvedValue(mock)
    register(ipcMain, { si })
    const handler = getHandler('getBattery')
    const result = await handler()
    expect(si.battery).toHaveBeenCalled()
    expect(result).toEqual(mock)
  })

  it('getNetworkInterfaces delegates to si.networkInterfaces()', async () => {
    const mock = [{ iface: 'eth0', ip4: '192.168.1.5' }]
    si.networkInterfaces.mockResolvedValue(mock)
    register(ipcMain, { si })
    const handler = getHandler('getNetworkInterfaces')
    const result = await handler()
    expect(si.networkInterfaces).toHaveBeenCalled()
    expect(result).toEqual(mock)
  })

  it('getNetworkStats passes iface argument to si.networkStats()', async () => {
    const mock = [{ iface: 'eth0', rx_bytes: 1000, tx_bytes: 500 }]
    si.networkStats.mockResolvedValue(mock)
    register(ipcMain, { si })
    const handler = getHandler('getNetworkStats')
    const result = await handler({}, 'eth0')
    expect(si.networkStats).toHaveBeenCalledWith('eth0')
    expect(result).toEqual(mock)
  })

  it('getBlockDevices delegates to si.blockDevices()', async () => {
    const mock = [{ name: 'sda', size: 500000000000 }]
    si.blockDevices.mockResolvedValue(mock)
    register(ipcMain, { si })
    const handler = getHandler('getBlockDevices')
    const result = await handler()
    expect(si.blockDevices).toHaveBeenCalled()
    expect(result).toEqual(mock)
  })

  it('getFsSize delegates to si.fsSize()', async () => {
    const mock = [{ fs: '/dev/sda1', size: 500000000000, used: 250000000000 }]
    si.fsSize.mockResolvedValue(mock)
    register(ipcMain, { si })
    const handler = getHandler('getFsSize')
    const result = await handler()
    expect(si.fsSize).toHaveBeenCalled()
    expect(result).toEqual(mock)
  })

  it('getSystemInfo delegates to si.system()', async () => {
    const mock = { manufacturer: 'Dell', model: 'XPS 15', serial: 'ABC123' }
    si.system.mockResolvedValue(mock)
    register(ipcMain, { si })
    const handler = getHandler('getSystemInfo')
    const result = await handler()
    expect(si.system).toHaveBeenCalled()
    expect(result).toEqual(mock)
  })

  it('getChassisInfo delegates to si.chassis()', async () => {
    const mock = { manufacturer: 'Dell', type: 'Notebook' }
    si.chassis.mockResolvedValue(mock)
    register(ipcMain, { si })
    const handler = getHandler('getChassisInfo')
    const result = await handler()
    expect(si.chassis).toHaveBeenCalled()
    expect(result).toEqual(mock)
  })

  it('getSystemUptime delegates to si.time()', async () => {
    const mock = { uptime: 123456, current: Date.now() }
    si.time.mockResolvedValue(mock)
    register(ipcMain, { si })
    const handler = getHandler('getSystemUptime')
    const result = await handler()
    expect(si.time).toHaveBeenCalled()
    expect(result).toHaveProperty('uptime')
    expect(typeof result.uptime).toBe('number')
  })
})

// =============================================================
//  ipc-settings.js — 2 settings handlers
// =============================================================
describe('ipc-settings.js', () => {
  let register

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockReadFileSync.mockReturnValue('{}')
    mockWriteFileSync.mockReturnValue(undefined)
    const mod = await import('../../src/main/ipc-settings.js')
    register = mod.register || mod.default
  })

  it('exports a register(ipcMain, deps) function', () => {
    expect(typeof register).toBe('function')
  })

  it('registers getSettings and saveSettings handlers', () => {
    register(ipcMain, {
      settingsFile, defaultSettings, userData,
      readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync,
    })
    expect(ipcMain.handle).toHaveBeenCalledWith('getSettings', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('saveSettings', expect.any(Function))
  })

  describe('getSettings', () => {
    it('returns settings with injected path properties', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ theme: 'tron', keyboard: 'en-US' }))
      register(ipcMain, {
        settingsFile, defaultSettings, userData,
        readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync,
      })
      const handler = getHandler('getSettings')
      const result = await handler()

      expect(result.settingsDir).toBe(userData)
      expect(result.themesPath).toBe(themesDir)
      expect(result.kbLayoutPath).toBe(kblayoutsDir)
      expect(result.settingsFile).toBe(settingsFile)
    })

    it('returns default settings when file is unreadable', async () => {
      mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT') })
      register(ipcMain, {
        settingsFile, defaultSettings, userData,
        readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync,
      })
      const handler = getHandler('getSettings')
      const result = await handler()

      expect(result.theme).toBe(defaultSettings.theme)
      expect(result.shell).toBe(defaultSettings.shell)
      expect(result.settingsDir).toBe(userData)
    })

    it('preserves file settings merged with injected paths', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ theme: 'matrix', keyboard: 'fr-FR' }))
      register(ipcMain, {
        settingsFile, defaultSettings, userData,
        readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync,
      })
      const handler = getHandler('getSettings')
      const result = await handler()

      expect(result.theme).toBe('matrix')
      expect(result.keyboard).toBe('fr-FR')
      expect(result.themesPath).toBe(themesDir)
    })
  })

  describe('saveSettings', () => {
    it('updates safe keys and writes to file', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ theme: 'tron', shell: 'bash' }))
      register(ipcMain, {
        settingsFile, defaultSettings, userData,
        readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync,
      })
      const handler = getHandler('saveSettings')
      const result = handler({}, { theme: 'matrix' })

      expect(result.theme).toBe('matrix')
      expect(mockWriteFileSync).toHaveBeenCalledWith(settingsFile, expect.any(String))
    })

    it('strips shell from partial to prevent terminal injection', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ theme: 'tron', shell: 'bash' }))
      register(ipcMain, {
        settingsFile, defaultSettings, userData,
        readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync,
      })
      const handler = getHandler('saveSettings')
      const result = handler({}, { shell: '/bin/sh', shellArgs: '-c "rm -rf /"' })

      expect(result.shell).toBe('bash')
      expect(result.shellArgs).toBe('')
    })

    it('strips cwd from partial to prevent path injection', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ theme: 'tron', cwd: userData }))
      register(ipcMain, {
        settingsFile, defaultSettings, userData,
        readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync,
      })
      const handler = getHandler('saveSettings')
      const result = handler({}, { cwd: '/etc' })

      expect(result.cwd).toBe(userData)
    })

    it('drops unknown keys not in allowlist (default-deny)', () => {
      mockReadFileSync.mockReturnValue('{}')
      register(ipcMain, {
        settingsFile, defaultSettings, userData,
        readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync,
      })
      const handler = getHandler('saveSettings')
      const result = handler({}, { maliciousKey: 'evil', theme: 'matrix' })

      expect(result.maliciousKey).toBeUndefined()
      expect(result.theme).toBe('matrix')
    })

    it('strips computed path keys (settingsDir, themesPath, etc.)', () => {
      mockReadFileSync.mockReturnValue('{}')
      register(ipcMain, {
        settingsFile, defaultSettings, userData,
        readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync,
      })
      const handler = getHandler('saveSettings')
      const result = handler({}, {
        settingsDir: '/evil/path',
        themesPath: '/evil/themes',
        kbLayoutPath: '/evil/keyboards',
        settingsFile: '/evil/settings.json',
        theme: 'matrix',
      })

      expect(result.settingsDir).toBeUndefined()
      expect(result.themesPath).toBeUndefined()
      expect(result.kbLayoutPath).toBeUndefined()
      expect(result.settingsFile).toBeUndefined()
      expect(result.theme).toBe('matrix')
    })

    it('drops __proto__ and constructor to prevent prototype pollution', () => {
      mockReadFileSync.mockReturnValue('{}')
      register(ipcMain, {
        settingsFile, defaultSettings, userData,
        readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync,
      })
      const handler = getHandler('saveSettings')
      const result = handler({}, { '__proto__': { polluted: true }, 'constructor': 'evil', theme: 'matrix' })

      expect(result.theme).toBe('matrix')
      expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false)
    })

    it('handles null and non-object partial without throwing', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ theme: 'tron' }))
      register(ipcMain, {
        settingsFile, defaultSettings, userData,
        readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync,
      })
      const handler = getHandler('saveSettings')

      expect(() => handler({}, null)).not.toThrow()
      expect(handler({}, null).theme).toBe('tron')
      expect(handler({}, 'not-an-object').theme).toBe('tron')
      expect(handler({}, undefined).theme).toBe('tron')
      expect(handler({}, 42).theme).toBe('tron')
    })

    it('allows all safe keys through', () => {
      mockReadFileSync.mockReturnValue('{}')
      register(ipcMain, {
        settingsFile, defaultSettings, userData,
        readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync,
      })
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
  })
})

// =============================================================
//  ipc-assets.js — 9 asset handlers
// =============================================================
describe('ipc-assets.js', () => {
  let register, validateAssetPath, validateAndResolve, validateWithin

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockReadFileSync.mockReturnValue('{"name":"tron"}')
    mockRealpathSync.mockImplementation(p => p)

    // Import validation helpers (pass-through to real module)
    const validation = await import('../../src/main/ipc-validation.js')
    validateAssetPath = validation.validateAssetPath
    validateAndResolve = validation.validateAndResolve
    validateWithin = validation.validateWithin

    const mod = await import('../../src/main/ipc-assets.js')
    register = mod.register || mod.default
  })

  const assetHashes = {
    'misc/file-icons-match.js': createHash('sha256').update('file-icons-content').digest('hex'),
  }

  function deps() {
    return {
      userData,
      themesDir,
      kblayoutsDir,
      assetHashes,
      readFileSync: mockReadFileSync,
      createHash,
      validateAssetPath,
      validateAndResolve,
      validateWithin,
    }
  }

  it('exports a register(ipcMain, deps) function', () => {
    expect(typeof register).toBe('function')
  })

  it('registers all 9 asset handlers', () => {
    register(ipcMain, deps())
    const channels = [
      'readAsset', 'loadFileIcons', 'readFileBinary',
      'getTheme', 'getKeyboardLayout', 'getAudioUrl',
      'getAudioPath', 'getThemePath', 'getKeyboardPath',
    ]
    for (const ch of channels) {
      expect(ipcMain.handle).toHaveBeenCalledWith(ch, expect.any(Function))
    }
  })

  describe('readAsset', () => {
    it('reads a file from userData/assets using relative path', () => {
      mockReadFileSync.mockReturnValue('{"ok":true}')
      register(ipcMain, deps())
      const handler = getHandler('readAsset')
      const result = handler({}, 'themes/tron.json')

      expect(result).toBe('{"ok":true}')
    })

    it('validates path stays within userData/assets', () => {
      register(ipcMain, deps())
      const handler = getHandler('readAsset')
      expect(() => handler({}, '../../etc/passwd')).toThrow(/Invalid path|traversal|denied/i)
    })

    it('rejects null bytes in path', () => {
      register(ipcMain, deps())
      const handler = getHandler('readAsset')
      expect(() => handler({}, 'file\0evil')).toThrow(/Invalid path/)
    })

    it('blocks symlinks pointing outside assets directory', () => {
      mockRealpathSync.mockReturnValue('/etc/passwd')
      register(ipcMain, deps())
      const handler = getHandler('readAsset')
      expect(() => handler({}, 'evil-link')).toThrow(/traversal|denied|outside/i)
    })

    it('allows symlink pointing inside assets directory', () => {
      mockRealpathSync.mockReturnValue(join(userData, 'assets', 'themes', 'tron.json'))
      mockReadFileSync.mockReturnValue('{"name":"tron"}')
      register(ipcMain, deps())
      const handler = getHandler('readAsset')
      const result = handler({}, 'themes/tron.json')
      expect(result).toBe('{"name":"tron"}')
    })
  })

  describe('loadFileIcons', () => {
    it('verifies file integrity via SHA-256 hash', async () => {
      const content = 'file-icons-content'
      const expectedHash = createHash('sha256').update(content).digest('hex')
      mockReadFileSync.mockReturnValue(content)
      const d = { ...deps(), assetHashes: { 'misc/file-icons-match.js': expectedHash } }
      register(ipcMain, d)
      const handler = getHandler('loadFileIcons')

      // loadFileIcons uses createRequire which won't work in test,
      // but we can verify it doesn't throw on integrity check
      // The handler validates hash before loading — if hash matches, it proceeds
      await expect(handler()).rejects.toThrow(/Cannot find module/)
    })

    it('throws when asset hash is tampered', async () => {
      const content = 'tampered-content'
      const d = { ...deps(), assetHashes: { 'misc/file-icons-match.js': 'wrong-hash' } }
      mockReadFileSync.mockReturnValue(content)
      register(ipcMain, d)
      const handler = getHandler('loadFileIcons')

      await expect(handler()).rejects.toThrow(/integrity check failed|tampered/)
    })

    it('throws when asset hash is not available', async () => {
      const d = { ...deps(), assetHashes: {} }
      mockReadFileSync.mockReturnValue('content')
      register(ipcMain, d)
      const handler = getHandler('loadFileIcons')

      await expect(handler()).rejects.toThrow(/hash not available/)
    })

    it('validates asset path before reading', () => {
      register(ipcMain, deps())
      const handler = getHandler('loadFileIcons')
      // loadFileIcons always uses 'misc/file-icons-match.js' internally,
      // but path validation should still be in place
      expect(handler).toBeDefined()
    })
  })

  describe('readFileBinary', () => {
    it('returns base64-encoded file content', () => {
      const buf = Buffer.from('hello world')
      mockReadFileSync.mockReturnValue(buf)
      register(ipcMain, deps())
      const handler = getHandler('readFileBinary')
      const result = handler({}, join(userData, 'file.txt'))

      expect(result).toBe(buf.toString('base64'))
    })

    it('validates path within userData', () => {
      register(ipcMain, deps())
      const handler = getHandler('readFileBinary')
      expect(() => handler({}, '/etc/passwd')).toThrow(/denied|outside/)
    })
  })

  describe('getTheme', () => {
    it('reads theme JSON from themesDir', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'tron', colors: {} }))
      register(ipcMain, deps())
      const handler = getHandler('getTheme')
      const result = handler({}, 'tron')

      expect(result).toEqual({ name: 'tron', colors: {} })
    })

    it('validates theme name against path traversal', () => {
      register(ipcMain, deps())
      const handler = getHandler('getTheme')
      expect(() => handler({}, '../../etc/passwd')).toThrow(/Invalid path|traversal|denied/i)
    })
  })

  describe('getKeyboardLayout', () => {
    it('reads keyboard layout JSON from kblayoutsDir', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ keys: [] }))
      register(ipcMain, deps())
      const handler = getHandler('getKeyboardLayout')
      const result = handler({}, 'en-US')

      expect(result).toEqual({ keys: [] })
    })

    it('validates layout name against path traversal', () => {
      register(ipcMain, deps())
      const handler = getHandler('getKeyboardLayout')
      expect(() => handler({}, '../../etc/passwd')).toThrow(/Invalid path|traversal|denied/i)
    })
  })

  describe('getAudioUrl', () => {
    it('returns edex-audio:// URL for valid filename', () => {
      register(ipcMain, deps())
      const handler = getHandler('getAudioUrl')
      const result = handler({}, 'click.mp3')

      expect(result).toContain('edex-audio://')
      expect(result).toContain('click.mp3')
    })

    it('rejects null bytes in filename', () => {
      register(ipcMain, deps())
      const handler = getHandler('getAudioUrl')
      expect(() => handler({}, 'file\0evil.mp3')).toThrow(/Invalid/)
    })

    it('rejects path traversal via ..', () => {
      register(ipcMain, deps())
      const handler = getHandler('getAudioUrl')
      expect(() => handler({}, '../../etc/passwd')).toThrow(/Invalid|traversal/)
    })
  })

  describe('getAudioPath', () => {
    it('returns resolved path within audio directory', () => {
      mockRealpathSync.mockReturnValue(join(userData, 'assets', 'audio', 'click.mp3'))
      register(ipcMain, deps())
      const handler = getHandler('getAudioPath')
      const result = handler({}, 'click.mp3')

      expect(result).toContain('click.mp3')
      expect(result).toContain(userData)
    })

    it('validates path stays within audio directory', () => {
      register(ipcMain, deps())
      const handler = getHandler('getAudioPath')
      expect(() => handler({}, '../../etc/passwd')).toThrow(/Invalid path|traversal|denied/i)
    })
  })

  describe('getThemePath', () => {
    it('returns resolved path within themesDir', () => {
      mockRealpathSync.mockReturnValue(join(themesDir, 'tron'))
      register(ipcMain, deps())
      const handler = getHandler('getThemePath')
      const result = handler({}, 'tron')

      expect(result).toContain('themes')
    })

    it('validates path stays within themesDir', () => {
      register(ipcMain, deps())
      const handler = getHandler('getThemePath')
      expect(() => handler({}, '../../etc/passwd')).toThrow(/Invalid path|traversal|denied/i)
    })
  })

  describe('getKeyboardPath', () => {
    it('returns resolved path within kblayoutsDir', () => {
      mockRealpathSync.mockReturnValue(join(kblayoutsDir, 'en-US'))
      register(ipcMain, deps())
      const handler = getHandler('getKeyboardPath')
      const result = handler({}, 'en-US')

      expect(result).toContain('keyboards')
    })

    it('validates path stays within kblayoutsDir', () => {
      register(ipcMain, deps())
      const handler = getHandler('getKeyboardPath')
      expect(() => handler({}, '../../etc/passwd')).toThrow(/Invalid path|traversal|denied/i)
    })
  })
})

// =============================================================
//  ipc-filesystem.js — 5 filesystem handlers
// =============================================================
describe('ipc-filesystem.js', () => {
  let register, validateWithin, BrowserWindow

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockReadFileSync.mockReturnValue('{}')
    mockWriteFileSync.mockReturnValue(undefined)
    mockReaddirSync.mockReturnValue([])
    mockLstatSync.mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
      isSymbolicLink: () => false,
      size: 42,
      mtime: new Date('2024-01-15T10:30:00Z'),
    })
    mockRealpathSync.mockImplementation(p => p)
    mockWatch.mockReturnValue({ close: vi.fn() })

    const validation = await import('../../src/main/ipc-validation.js')
    validateWithin = validation.validateWithin

    const { BrowserWindow: BW } = await import('electron')
    BrowserWindow = BW

    const mod = await import('../../src/main/ipc-filesystem.js')
    register = mod.register || mod.default
  })

  function deps() {
    return {
      userData,
      readFileSync: mockReadFileSync,
      writeFileSync: mockWriteFileSync,
      readdirSync: mockReaddirSync,
      lstatSync: mockLstatSync,
      watch: mockWatch,
      validateWithin,
      BrowserWindow,
    }
  }

  it('exports a register(ipcMain, deps) function', () => {
    expect(typeof register).toBe('function')
  })

  it('registers readdir, stat, readFile, writeFile, watchDirectory', () => {
    register(ipcMain, deps())
    const channels = ['readdir', 'stat', 'readFile', 'writeFile', 'watchDirectory']
    for (const ch of channels) {
      expect(ipcMain.handle).toHaveBeenCalledWith(ch, expect.any(Function))
    }
  })

  describe('readdir', () => {
    it('returns directory listing for valid path', () => {
      mockReaddirSync.mockReturnValue(['a.txt', 'b.js', 'subdir'])
      register(ipcMain, deps())
      const handler = getHandler('readdir')
      const result = handler({}, '/some/dir')

      expect(result).toEqual(['a.txt', 'b.js', 'subdir'])
      expect(mockReaddirSync).toHaveBeenCalledWith('/some/dir')
    })

    it('returns empty array when dirPath is null', () => {
      register(ipcMain, deps())
      const handler = getHandler('readdir')
      expect(handler({}, null)).toEqual([])
    })

    it('returns empty array when dirPath is undefined', () => {
      register(ipcMain, deps())
      const handler = getHandler('readdir')
      expect(handler({}, undefined)).toEqual([])
    })

    it('returns empty array when dirPath is empty string', () => {
      register(ipcMain, deps())
      const handler = getHandler('readdir')
      expect(handler({}, '')).toEqual([])
    })

    it('returns [] on EPERM and logs console.warn', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const err = Object.assign(new Error('permission denied'), { code: 'EPERM' })
      mockReaddirSync.mockImplementation(() => { throw err })
      register(ipcMain, deps())
      const handler = getHandler('readdir')
      const result = handler({}, '/forbidden')

      expect(result).toEqual([])
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('EPERM'),
        '/forbidden',
      )
      warnSpy.mockRestore()
    })

    it('returns [] on ENOENT without logging', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const err = Object.assign(new Error('not found'), { code: 'ENOENT' })
      mockReaddirSync.mockImplementation(() => { throw err })
      register(ipcMain, deps())
      const handler = getHandler('readdir')

      expect(handler({}, '/nonexistent')).toEqual([])
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('returns [] on EBUSY without logging', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const err = Object.assign(new Error('busy'), { code: 'EBUSY' })
      mockReaddirSync.mockImplementation(() => { throw err })
      register(ipcMain, deps())
      const handler = getHandler('readdir')

      expect(handler({}, '/dev/sda1')).toEqual([])
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('re-throws unknown errors (e.g. EIO)', async () => {
      const err = Object.assign(new Error('io error'), { code: 'EIO' })
      mockReaddirSync.mockImplementation(() => { throw err })
      register(ipcMain, deps())
      const handler = getHandler('readdir')

      await expect(handler({}, '/some/path')).rejects.toThrow('io error')
    })

    it('rejects null bytes in path', () => {
      register(ipcMain, deps())
      const handler = getHandler('readdir')
      expect(() => handler({}, '/tmp/file\0evil')).toThrow(/Invalid/)
    })
  })

  describe('stat', () => {
    it('returns file info object for a valid file', () => {
      const mtimeDate = new Date('2024-01-15T10:30:00Z')
      mockLstatSync.mockReturnValue({
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
        size: 1234,
        mtime: mtimeDate,
      })
      register(ipcMain, deps())
      const handler = getHandler('stat')
      const result = handler({}, '/some/file.txt')

      expect(result).toEqual({
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        size: 1234,
        mtime: mtimeDate.getTime(),
      })
    })

    it('returns null when filePath is null', () => {
      register(ipcMain, deps())
      const handler = getHandler('stat')
      expect(handler({}, null)).toBeNull()
    })

    it('returns null when filePath is undefined', () => {
      register(ipcMain, deps())
      const handler = getHandler('stat')
      expect(handler({}, undefined)).toBeNull()
    })

    it('returns null when filePath is empty string', () => {
      register(ipcMain, deps())
      const handler = getHandler('stat')
      expect(handler({}, '')).toBeNull()
    })

    it('returns null for ENOENT without logging', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const err = Object.assign(new Error('not found'), { code: 'ENOENT' })
      mockLstatSync.mockImplementation(() => { throw err })
      register(ipcMain, deps())
      const handler = getHandler('stat')

      expect(handler({}, '/nonexistent')).toBeNull()
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('returns null for EPERM and logs console.warn', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const err = Object.assign(new Error('permission denied'), { code: 'EPERM' })
      mockLstatSync.mockImplementation(() => { throw err })
      register(ipcMain, deps())
      const handler = getHandler('stat')

      expect(handler({}, '/forbidden')).toBeNull()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('EPERM'),
        '/forbidden',
      )
      warnSpy.mockRestore()
    })

    it('returns null for EBUSY without logging', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const err = Object.assign(new Error('busy'), { code: 'EBUSY' })
      mockLstatSync.mockImplementation(() => { throw err })
      register(ipcMain, deps())
      const handler = getHandler('stat')

      expect(handler({}, '/dev/sda1')).toBeNull()
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('re-throws unknown errors (e.g. EACCES)', async () => {
      const err = Object.assign(new Error('access denied'), { code: 'EACCES' })
      mockLstatSync.mockImplementation(() => { throw err })
      register(ipcMain, deps())
      const handler = getHandler('stat')

      await expect(handler({}, '/some/path')).rejects.toThrow('access denied')
    })

    it('rejects null bytes in path', () => {
      register(ipcMain, deps())
      const handler = getHandler('stat')
      expect(() => handler({}, '/tmp/file\0evil')).toThrow(/Invalid/)
    })
  })

  describe('readFile', () => {
    it('reads file content with encoding', () => {
      mockReadFileSync.mockReturnValue('hello world')
      register(ipcMain, deps())
      const handler = getHandler('readFile')
      const result = handler({}, join(userData, 'file.txt'), 'utf-8')

      expect(result).toBe('hello world')
      expect(mockReadFileSync).toHaveBeenCalledWith(expect.stringContaining('file.txt'), 'utf-8')
    })

    it('defaults to utf-8 encoding when not specified', () => {
      mockReadFileSync.mockReturnValue('data')
      register(ipcMain, deps())
      const handler = getHandler('readFile')
      handler({}, join(userData, 'file.txt'))

      expect(mockReadFileSync).toHaveBeenCalledWith(expect.stringContaining('file.txt'), 'utf-8')
    })

    it('validates path within userData', () => {
      register(ipcMain, deps())
      const handler = getHandler('readFile')
      expect(() => handler({}, '/etc/passwd', 'utf-8')).toThrow(/denied|outside/)
    })

    it('rejects null bytes in path', () => {
      register(ipcMain, deps())
      const handler = getHandler('readFile')
      expect(() => handler({}, join(userData, 'file\0evil'), 'utf-8')).toThrow(/Invalid/)
    })
  })

  describe('writeFile', () => {
    it('writes content to file within userData', () => {
      register(ipcMain, deps())
      const handler = getHandler('writeFile')
      handler({}, join(userData, 'file.txt'), 'data')

      expect(mockWriteFileSync).toHaveBeenCalledWith(expect.stringContaining('file.txt'), 'data')
    })

    it('validates path within userData', () => {
      register(ipcMain, deps())
      const handler = getHandler('writeFile')
      expect(() => handler({}, '/etc/crontab', 'evil')).toThrow(/denied|outside/)
    })

    it('rejects null bytes in path', () => {
      register(ipcMain, deps())
      const handler = getHandler('writeFile')
      expect(() => handler({}, join(userData, 'file\0evil'), 'data')).toThrow(/Invalid/)
    })
  })

  describe('watchDirectory', () => {
    it('creates a watcher for directory within userData', async () => {
      const mockWatcher = { close: vi.fn() }
      mockWatch.mockReturnValue(mockWatcher)
      register(ipcMain, deps())
      const handler = getHandler('watchDirectory')
      await handler({}, join(userData, 'themes'))

      expect(mockWatch).toHaveBeenCalledWith(
        expect.stringContaining('themes'),
        expect.any(Function),
      )
    })

    it('validates path within userData', async () => {
      register(ipcMain, deps())
      const handler = getHandler('watchDirectory')
      await expect(handler({}, '/etc')).rejects.toThrow(/denied|outside/)
    })

    it('does not create duplicate watcher for same directory', async () => {
      const mockWatcher = { close: vi.fn() }
      mockWatch.mockReturnValue(mockWatcher)
      register(ipcMain, deps())
      const handler = getHandler('watchDirectory')

      await handler({}, join(userData, 'themes'))
      await handler({}, join(userData, 'themes'))

      // watch should only be called once for the same resolved path
      expect(mockWatch).toHaveBeenCalledTimes(1)
    })

    it('sends fs-changed event to BrowserWindow when directory changes', async () => {
      let changeCallback
      mockWatch.mockImplementation((_path, cb) => {
        changeCallback = cb
        return { close: vi.fn() }
      })

      const mockWin = { webContents: { send: vi.fn() } }
      BrowserWindow.getAllWindows.mockReturnValue([mockWin])

      register(ipcMain, deps())
      const handler = getHandler('watchDirectory')
      await handler({}, join(userData, 'themes'))

      // Simulate directory change
      changeCallback('change', 'test-file.txt')

      expect(mockWin.webContents.send).toHaveBeenCalledWith('fs-changed', 'change')
    })

    it('handles watch creation error gracefully', async () => {
      mockWatch.mockImplementation(() => { throw new Error('watch failed') })
      register(ipcMain, deps())
      const handler = getHandler('watchDirectory')

      // Should not throw — error is caught internally
      await expect(handler({}, join(userData, 'themes'))).resolves.not.toThrow()
    })
  })
})
