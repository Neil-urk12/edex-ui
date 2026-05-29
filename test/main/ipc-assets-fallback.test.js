import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// --- fs mock (feeds into readJsonFile via ipc-helpers.js) ---
const mockReadFileSync = vi.fn()
vi.mock('fs', () => ({
  readFileSync: (...args) => mockReadFileSync(...args),
}))


import { register } from '../../src/main/ipc-assets.js'

function createMockIpcMain() {
  const handlers = {}
  const listeners = {}
  return {
    handle: vi.fn((channel, handler) => { handlers[channel] = handler }),
    on: vi.fn((channel, handler) => { listeners[channel] = handler }),
    _handlers: handlers,
    _listeners: listeners,
  }
}

describe('ipc-assets — getTheme / getKeyboardLayout fallback on error', () => {
  let ipcMain
  let warnSpy

  beforeEach(() => {
    vi.clearAllMocks()
    ipcMain = createMockIpcMain()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    register(ipcMain, {
      userData: '/tmp/user',
      themesDir: '/tmp/themes',
      kblayoutsDir: '/tmp/keyboards',
      assetHashes: {},
      readFileSync: mockReadFileSync,
      createHash: { update: () => ({ digest: () => 'deadbeef' }) },
      validateAssetPath: vi.fn((rel, base) => `${base}/${rel}`),
      validateAndResolve: vi.fn((name, dir) => `${dir}/${name}`),
      validateWithin: vi.fn((p) => p),
    })
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  // -------------------------------------------------------------------
  // getTheme
  // -------------------------------------------------------------------
  describe('getTheme', () => {
    it('returns parsed theme when file exists', async () => {
      mockReadFileSync.mockReturnValue('{"name":"nord"}')

      const result = await ipcMain._handlers['getTheme'](null, 'nord')

      expect(result).toEqual({ name: 'nord' })
    })

    it('returns empty object (not undefined) when theme file is missing', async () => {
      const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
      mockReadFileSync.mockImplementation(() => { throw enoent })

      const result = await ipcMain._handlers['getTheme'](null, 'nonexistent')

      expect(result).not.toBeUndefined()
      expect(result).toEqual({})
    })

    it('returns empty object (not undefined) when theme file has invalid JSON', async () => {
      mockReadFileSync.mockReturnValue('not valid json {{{')

      const result = await ipcMain._handlers['getTheme'](null, 'broken')

      expect(result).not.toBeUndefined()
      expect(result).toEqual({})
    })
  })

  // -------------------------------------------------------------------
  // getKeyboardLayout
  // -------------------------------------------------------------------
  describe('getKeyboardLayout', () => {
    it('returns parsed layout when file exists', async () => {
      mockReadFileSync.mockReturnValue('{"layout":"en-US"}')

      const result = await ipcMain._handlers['getKeyboardLayout'](null, 'en-US')

      expect(result).toEqual({ layout: 'en-US' })
    })

    it('returns empty object (not undefined) when layout file is missing', async () => {
      const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
      mockReadFileSync.mockImplementation(() => { throw enoent })

      const result = await ipcMain._handlers['getKeyboardLayout'](null, 'nonexistent')

      expect(result).not.toBeUndefined()
      expect(result).toEqual({})
    })

    it('returns empty object (not undefined) when layout file has invalid JSON', async () => {
      mockReadFileSync.mockReturnValue('not valid json {{{')

      const result = await ipcMain._handlers['getKeyboardLayout'](null, 'broken')

      expect(result).not.toBeUndefined()
      expect(result).toEqual({})
    })
  })
})
