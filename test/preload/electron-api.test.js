/**
 * Tests for merged electronAPI preload bridge
 *
 * Verifies src/preload/index.js exposes all methods from
 * app, terminal, filesystem, and system sub-modules via contextBridge.
 *
 * Strategy: mock electron's contextBridge.exposeInMainWorld and capture
 * the API object passed as the second argument, then test it directly.
 */
import { describe, test, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
    removeListener: vi.fn(),
  },
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
}))

let electronAPI

beforeAll(async () => {
  const { contextBridge } = await import('electron')
  await import('../../src/preload/index.js')

  // index.js calls contextBridge.exposeInMainWorld('electronAPI', { ... })
  // Capture the merged API object
  expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
    'electronAPI',
    expect.any(Object),
  )
  electronAPI = contextBridge.exposeInMainWorld.mock.calls[0][1]
})

describe('electronAPI merged preload bridge', () => {
  let ipcRenderer

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ ipcRenderer } = await import('electron'))
  })

  // ══════════════════════════════════════════════════════════════════════
  // Complete method inventory — all 53 methods across 4 sub-modules
  // ══════════════════════════════════════════════════════════════════════

  describe('complete method inventory', () => {
    // app (25) + terminal (8) + filesystem (7) + system (13) = 53
    const expectedMethods = [
      // app
      'getAppVersion',
      'getAppPath',
      'quitApp',
      'getDisplays',
      'getClipboardText',
      'setClipboardText',
      'openPath',
      'registerShortcut',
      'unregisterShortcut',
      'getSettings',
      'saveSettings',
      'getAudioPath',
      'getAudioUrl',
      'getThemePath',
      'getTheme',
      'getKeyboardPath',
      'getKeyboardLayout',
      'readAsset',
      'readFileBinary',
      'getThemeOverride',
      'getKbOverride',
      'setThemeOverride',
      'setKbOverride',
      'onShortcutTriggered',
      'toggleFullscreen',
      // terminal
      'createTerminal',
      'writeTerminal',
      'resizeTerminal',
      'killTerminal',
      'onTerminalData',
      'onTerminalExit',
      'onCwdChanged',
      'onProcessChanged',
      // filesystem
      'readdir',
      'stat',
      'readFile',
      'writeFile',
      'loadFileIcons',
      'watchDirectory',
      'onFsChanged',
      // system
      'getCpuInfo',
      'getCpuLoad',
      'getMemoryInfo',
      'getCpuTemperature',
      'getProcesses',
      'getBattery',
      'getNetworkInterfaces',
      'getNetworkStats',
      'getBlockDevices',
      'getFsSize',
      'getSystemInfo',
      'getChassisInfo',
      'getSystemUptime',
    ]

    test(`exposes exactly ${expectedMethods.length} methods`, () => {
      expect(Object.keys(electronAPI)).toHaveLength(expectedMethods.length)
    })

    test.each(expectedMethods)('has method "%s"', (method) => {
      expect(electronAPI).toHaveProperty(method)
      expect(typeof electronAPI[method]).toBe('function')
    })

    test('no unexpected methods beyond the known set', () => {
      const knownSet = new Set(expectedMethods)
      for (const key of Object.keys(electronAPI)) {
        expect(knownSet).toContain(key)
      }
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  // app API — IPC channel mapping
  // ══════════════════════════════════════════════════════════════════════

  describe('app API methods', () => {
    // invoke-based methods (no args)
    test.each([
      ['getAppVersion', 'getAppVersion', [], '1.0.0'],
      ['quitApp', 'quitApp', [], undefined],
      ['getDisplays', 'getDisplays', [], [{ id: 1 }]],
      ['getClipboardText', 'getClipboardText', [], 'hello'],
      ['getSettings', 'getSettings', [], { theme: 'default' }],
      ['getThemeOverride', 'getThemeOverride', [], '/path/override'],
      ['getKbOverride', 'getKbOverride', [], '/path/kb-override'],
      ['toggleFullscreen', 'toggleFullscreen', [], true],
    ])('%s calls invoke("%s")', async (method, channel, args, mockResult) => {
      ipcRenderer.invoke.mockResolvedValue(mockResult)
      const result = await electronAPI[method](...args)
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(channel)
      expect(result).toBe(mockResult)
    })

    // invoke-based methods (with args)
    test('getAppPath calls invoke("getAppPath", name)', async () => {
      ipcRenderer.invoke.mockResolvedValue('/home/user')
      const result = await electronAPI.getAppPath('home')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getAppPath', 'home')
      expect(result).toBe('/home/user')
    })

    test('setClipboardText calls invoke("setClipboardText", text)', async () => {
      ipcRenderer.invoke.mockResolvedValue(undefined)
      await electronAPI.setClipboardText('copied')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('setClipboardText', 'copied')
    })

    test('openPath calls invoke("openPath", path)', async () => {
      ipcRenderer.invoke.mockResolvedValue(undefined)
      await electronAPI.openPath('/tmp/file.txt')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('openPath', '/tmp/file.txt')
    })

    test('registerShortcut calls invoke("registerShortcut", accelerator, id)', async () => {
      ipcRenderer.invoke.mockResolvedValue(true)
      const result = await electronAPI.registerShortcut('CmdOrCtrl+Shift+K', 'kb-toggle')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('registerShortcut', 'CmdOrCtrl+Shift+K', 'kb-toggle')
      expect(result).toBe(true)
    })

    test('unregisterShortcut calls invoke("unregisterShortcut", accelerator)', async () => {
      ipcRenderer.invoke.mockResolvedValue(undefined)
      await electronAPI.unregisterShortcut('CmdOrCtrl+Shift+K')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('unregisterShortcut', 'CmdOrCtrl+Shift+K')
    })

    test('saveSettings calls invoke("saveSettings", partial)', async () => {
      ipcRenderer.invoke.mockResolvedValue(undefined)
      await electronAPI.saveSettings({ theme: 'tron' })
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('saveSettings', { theme: 'tron' })
    })

    test('getAudioPath calls invoke("getAudioPath", filename)', async () => {
      ipcRenderer.invoke.mockResolvedValue('/path/beep.mp3')
      const result = await electronAPI.getAudioPath('beep.mp3')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getAudioPath', 'beep.mp3')
      expect(result).toBe('/path/beep.mp3')
    })

    test('getAudioUrl calls invoke("getAudioUrl", filename)', async () => {
      ipcRenderer.invoke.mockResolvedValue('file:///path/beep.mp3')
      const result = await electronAPI.getAudioUrl('beep.mp3')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getAudioUrl', 'beep.mp3')
      expect(result).toBe('file:///path/beep.mp3')
    })

    test('getThemePath calls invoke("getThemePath", name)', async () => {
      ipcRenderer.invoke.mockResolvedValue('/path/theme')
      const result = await electronAPI.getThemePath('tron')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getThemePath', 'tron')
      expect(result).toBe('/path/theme')
    })

    test('getTheme calls invoke("getTheme", name)', async () => {
      ipcRenderer.invoke.mockResolvedValue({ name: 'tron', colors: {} })
      const result = await electronAPI.getTheme('tron')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getTheme', 'tron')
      expect(result).toEqual({ name: 'tron', colors: {} })
    })

    test('getKeyboardPath calls invoke("getKeyboardPath", name)', async () => {
      ipcRenderer.invoke.mockResolvedValue('/path/kb')
      const result = await electronAPI.getKeyboardPath('en-US')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getKeyboardPath', 'en-US')
      expect(result).toBe('/path/kb')
    })

    test('getKeyboardLayout calls invoke("getKeyboardLayout", name)', async () => {
      ipcRenderer.invoke.mockResolvedValue({ name: 'en-US', keys: [] })
      const result = await electronAPI.getKeyboardLayout('en-US')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getKeyboardLayout', 'en-US')
      expect(result).toEqual({ name: 'en-US', keys: [] })
    })

    test('readAsset calls invoke("readAsset", relativePath)', async () => {
      ipcRenderer.invoke.mockResolvedValue('asset-data')
      const result = await electronAPI.readAsset('sounds/beep.mp3')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('readAsset', 'sounds/beep.mp3')
      expect(result).toBe('asset-data')
    })

    test('readFileBinary calls invoke("readFileBinary", filePath)', async () => {
      const buf = new ArrayBuffer(8)
      ipcRenderer.invoke.mockResolvedValue(buf)
      const result = await electronAPI.readFileBinary('/tmp/image.png')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('readFileBinary', '/tmp/image.png')
      expect(result).toBe(buf)
    })

    // send-based methods (fire-and-forget)
    test('setThemeOverride calls send("setThemeOverride", arg)', () => {
      electronAPI.setThemeOverride('/new/override')
      expect(ipcRenderer.send).toHaveBeenCalledWith('setThemeOverride', '/new/override')
    })

    test('setKbOverride calls send("setKbOverride", arg)', () => {
      electronAPI.setKbOverride('/new/kb-override')
      expect(ipcRenderer.send).toHaveBeenCalledWith('setKbOverride', '/new/kb-override')
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  // terminal API — IPC channel mapping
  // ══════════════════════════════════════════════════════════════════════

  describe('terminal API methods', () => {
    test('createTerminal calls invoke("terminal:create", options)', async () => {
      ipcRenderer.invoke.mockResolvedValue({ id: 'term-1' })
      const result = await electronAPI.createTerminal({ cols: 80, rows: 24 })
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('terminal:create', { cols: 80, rows: 24 })
      expect(result).toEqual({ id: 'term-1' })
    })

    test('writeTerminal calls send("terminal:write", { id, data })', () => {
      electronAPI.writeTerminal('term-1', 'ls\n')
      expect(ipcRenderer.send).toHaveBeenCalledWith('terminal:write', { id: 'term-1', data: 'ls\n' })
    })

    test('resizeTerminal calls send("terminal:resize", { id, cols, rows })', () => {
      electronAPI.resizeTerminal('term-1', 120, 40)
      expect(ipcRenderer.send).toHaveBeenCalledWith('terminal:resize', { id: 'term-1', cols: 120, rows: 40 })
    })

    test('killTerminal calls invoke("terminal:kill", id)', async () => {
      ipcRenderer.invoke.mockResolvedValue(undefined)
      await electronAPI.killTerminal('term-1')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('terminal:kill', 'term-1')
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  // filesystem API — IPC channel mapping
  // ══════════════════════════════════════════════════════════════════════

  describe('filesystem API methods', () => {
    test('readdir calls invoke("readdir", dirPath)', async () => {
      ipcRenderer.invoke.mockResolvedValue(['a.txt', 'b.txt'])
      const result = await electronAPI.readdir('/tmp')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('readdir', '/tmp')
      expect(result).toEqual(['a.txt', 'b.txt'])
    })

    test('stat calls invoke("stat", filePath)', async () => {
      ipcRenderer.invoke.mockResolvedValue({ size: 1024, isFile: true })
      const result = await electronAPI.stat('/tmp/a.txt')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('stat', '/tmp/a.txt')
      expect(result).toEqual({ size: 1024, isFile: true })
    })

    test('readFile calls invoke("readFile", filePath, encoding)', async () => {
      ipcRenderer.invoke.mockResolvedValue('contents')
      const result = await electronAPI.readFile('/tmp/a.txt', 'utf-8')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('readFile', '/tmp/a.txt', 'utf-8')
      expect(result).toBe('contents')
    })

    test('writeFile calls invoke("writeFile", filePath, content)', async () => {
      ipcRenderer.invoke.mockResolvedValue(undefined)
      await electronAPI.writeFile('/tmp/out.txt', 'data')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('writeFile', '/tmp/out.txt', 'data')
    })

    test('loadFileIcons calls invoke("loadFileIcons")', async () => {
      ipcRenderer.invoke.mockResolvedValue({ '.js': 'icon-js' })
      const result = await electronAPI.loadFileIcons()
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('loadFileIcons')
      expect(result).toEqual({ '.js': 'icon-js' })
    })

    test('watchDirectory calls invoke("watchDirectory", dirPath)', async () => {
      ipcRenderer.invoke.mockResolvedValue(undefined)
      await electronAPI.watchDirectory('/tmp')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('watchDirectory', '/tmp')
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  // system API — IPC channel mapping
  // ══════════════════════════════════════════════════════════════════════

  describe('system API methods', () => {
    // No-arg invoke methods
    test.each([
      ['getCpuInfo', { manufacturer: 'Intel', brand: 'Core i7', cores: 8 }],
      ['getCpuLoad', { currentLoad: 45.2, cpus: [] }],
      ['getMemoryInfo', { total: 16384, free: 8192, used: 8192 }],
      ['getCpuTemperature', { main: 55, cores: [] }],
      ['getProcesses', { all: 150, running: 3, list: [] }],
      ['getBattery', { hasBattery: true, percent: 85 }],
      ['getNetworkInterfaces', [{ iface: 'eth0', ip4: '192.168.1.100' }]],
      ['getBlockDevices', [{ name: '/dev/sda1', size: 512000000000 }]],
      ['getFsSize', [{ fs: '/dev/sda1', size: 512000000000, used: 256000000000 }]],
      ['getSystemInfo', { manufacturer: 'Dell', model: 'XPS 15', serial: 'ABC123', uuid: 'uid', sku: 'SKU' }],
      ['getChassisInfo', { manufacturer: 'Dell', model: 'XPS 15', type: 'Notebook' }],
      ['getSystemUptime', 123456],
    ])('%s calls invoke("%s")', async (method, mockResult) => {
      ipcRenderer.invoke.mockResolvedValue(mockResult)
      const result = await electronAPI[method]()
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(method)
      expect(result).toBe(mockResult)
    })

    // With-arg invoke methods
    test('getNetworkStats calls invoke("getNetworkStats", iface)', async () => {
      ipcRenderer.invoke.mockResolvedValue([{ iface: 'eth0', rx_bytes: 1024, tx_bytes: 512 }])
      const result = await electronAPI.getNetworkStats('eth0')
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getNetworkStats', 'eth0')
      expect(result).toEqual([{ iface: 'eth0', rx_bytes: 1024, tx_bytes: 512 }])
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  // Event listener unsubscribe pattern
  //
  // 6 methods register ipcRenderer.on listeners and return an unsubscribe
  // function that calls removeListener with the same handler reference.
  // ══════════════════════════════════════════════════════════════════════

  describe('event listener unsubscribe pattern', () => {
    // [method, channel, ipcPayload, expectedCallbackArgs]
    const listenerMethods = [
      ['onTerminalData', 'terminal:data', { id: 't1', data: 'output' }, ['t1', 'output']],
      ['onTerminalExit', 'terminal:exit', { id: 't1', exitCode: 0, signal: null }, ['t1', 0, null]],
      ['onCwdChanged', 'terminal:cwd-changed', { id: 't1', cwd: '/home' }, ['t1', '/home']],
      ['onProcessChanged', 'terminal:process-changed', { id: 't1', process: 'bash' }, ['t1', 'bash']],
      ['onFsChanged', 'fs-changed', '/tmp', ['/tmp']],
      ['onShortcutTriggered', 'shortcut-triggered', 'kb-toggle', ['kb-toggle']],
    ]

    test.each(listenerMethods)(
      '%s registers on("%s") and returns unsubscribe',
      (method, channel, ipcPayload, expectedArgs) => {
        const callback = vi.fn()

        // Register — should call ipcRenderer.on
        const unsubscribe = electronAPI[method](callback)
        expect(typeof unsubscribe).toBe('function')
        expect(ipcRenderer.on).toHaveBeenCalledWith(channel, expect.any(Function))

        // Verify handler unwraps the IPC payload correctly
        const handler = ipcRenderer.on.mock.calls[0][1]
        handler({}, ipcPayload)
        expect(callback).toHaveBeenCalledWith(...expectedArgs)

        // Unsubscribe — should remove the exact same handler
        callback.mockClear()
        unsubscribe()
        expect(ipcRenderer.removeListener).toHaveBeenCalledWith(channel, expect.any(Function))

        const removedHandler = ipcRenderer.removeListener.mock.calls[0][1]
        expect(removedHandler).toBe(handler)
      },
    )

    test('unsubscribe is idempotent — calling twice does not throw', () => {
      const unsubscribe = electronAPI.onTerminalData(vi.fn())
      unsubscribe()
      unsubscribe()
      expect(ipcRenderer.removeListener).toHaveBeenCalledTimes(2)
    })

    test('multiple listeners on same channel are independent', () => {
      const cb1 = vi.fn()
      const cb2 = vi.fn()

      const unsub1 = electronAPI.onTerminalData(cb1)
      const unsub2 = electronAPI.onTerminalData(cb2)

      // Two handlers registered
      expect(ipcRenderer.on).toHaveBeenCalledTimes(2)
      const handler1 = ipcRenderer.on.mock.calls[0][1]
      const handler2 = ipcRenderer.on.mock.calls[1][1]

      // Unsub first — only first handler removed
      unsub1()
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith('terminal:data', handler1)

      // Second handler still works
      handler2({}, { id: 't2', data: 'still alive' })
      expect(cb2).toHaveBeenCalledWith('t2', 'still alive')

      unsub2()
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith('terminal:data', handler2)
    })
  })
})
