import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// --- fs mock ---
const mockReadFileSync = vi.fn()
const mockMkdirSync = vi.fn()

vi.mock('fs', () => ({
  readFileSync: (...args) => mockReadFileSync(...args),
  mkdirSync: (...args) => mockMkdirSync(...args),
}))

// Import the module under test — DOES NOT EXIST YET, tests will fail
import { sendToMainWindow, readJsonFile, ensureDir } from '../../src/main/ipc-helpers.js'

// =============================================================
//  sendToMainWindow — extracted from repeated guard pattern
// =============================================================
describe('sendToMainWindow', () => {
  it('calls webContents.send when window is valid', () => {
    const win = {
      isDestroyed: () => false,
      webContents: { send: vi.fn() },
    }

    sendToMainWindow(win, 'terminal:data', { id: 1, data: 'hello' })

    expect(win.webContents.send).toHaveBeenCalledWith('terminal:data', { id: 1, data: 'hello' })
  })

  it('does not call send when window is destroyed', () => {
    const win = {
      isDestroyed: () => true,
      webContents: { send: vi.fn() },
    }

    sendToMainWindow(win, 'terminal:data', { id: 1, data: 'hello' })

    expect(win.webContents.send).not.toHaveBeenCalled()
  })

  it('does not call send when window is null', () => {
    expect(() => sendToMainWindow(null, 'terminal:data', { id: 1, data: 'hello' })).not.toThrow()
  })

  it('does not call send when window is undefined', () => {
    expect(() => sendToMainWindow(undefined, 'terminal:data', { id: 1, data: 'hello' })).not.toThrow()
  })

  it('passes through any channel name', () => {
    const win = {
      isDestroyed: () => false,
      webContents: { send: vi.fn() },
    }

    sendToMainWindow(win, 'terminal:exit', { id: 2, exitCode: 0, signal: null })

    expect(win.webContents.send).toHaveBeenCalledWith('terminal:exit', { id: 2, exitCode: 0, signal: null })
  })

  it('passes through data argument unchanged', () => {
    const win = {
      isDestroyed: () => false,
      webContents: { send: vi.fn() },
    }
    const data = { nested: { deep: true } }

    sendToMainWindow(win, 'terminal:cwd-changed', data)

    expect(win.webContents.send.mock.calls[0][1]).toBe(data)
  })
})

// =============================================================
//  readJsonFile — extracted from repeated JSON.parse(readFileSync(...))
// =============================================================
describe('readJsonFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed JSON for a valid file', () => {
    mockReadFileSync.mockReturnValue('{"theme":"tron","keyboard":"en-US"}')

    const result = readJsonFile('/tmp/settings.json')

    expect(result).toEqual({ theme: 'tron', keyboard: 'en-US' })
    expect(mockReadFileSync).toHaveBeenCalledWith('/tmp/settings.json', 'utf-8')
  })

  it('returns fallback when file does not exist', () => {
    const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
    mockReadFileSync.mockImplementation(() => { throw enoent })

    const fallback = { theme: 'default' }
    const result = readJsonFile('/tmp/missing.json', fallback)

    expect(result).toEqual(fallback)
  })

  it('returns fallback when file contains invalid JSON', () => {
    mockReadFileSync.mockReturnValue('not valid json {{{')

    const fallback = { theme: 'default' }
    const result = readJsonFile('/tmp/corrupt.json', fallback)

    expect(result).toEqual(fallback)
  })

  it('returns undefined when no fallback is provided and file is missing', () => {
    const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
    mockReadFileSync.mockImplementation(() => { throw enoent })

    const result = readJsonFile('/tmp/missing.json')

    expect(result).toBeNull()
  })


  it('reads with utf-8 encoding', () => {
    mockReadFileSync.mockReturnValue('{"ok":true}')

    readJsonFile('/tmp/test.json')

    expect(mockReadFileSync).toHaveBeenCalledWith('/tmp/test.json', 'utf-8')
  })
})

// =============================================================
//  readJsonFile — console.warn logging (silent catch → warn)
// =============================================================
describe('readJsonFile - console.warn on errors', () => {
  let warnSpy

  beforeEach(() => {
    vi.clearAllMocks()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('logs a warning when file does not exist (ENOENT)', () => {
    const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
    mockReadFileSync.mockImplementation(() => { throw enoent })

    readJsonFile('/tmp/missing.json', {})

    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls[0].join(' ')).toContain('missing.json')
  })

  it('logs a warning when JSON is invalid', () => {
    mockReadFileSync.mockReturnValue('broken json')

    readJsonFile('/tmp/bad.json', {})

    expect(warnSpy).toHaveBeenCalled()
  })

  it('does NOT log a warning for successful reads', () => {
    mockReadFileSync.mockReturnValue('{"ok":true}')

    readJsonFile('/tmp/good.json', {})

    expect(warnSpy).not.toHaveBeenCalled()
  })
})

// =============================================================
//  ensureDir — extracted from repeated try { mkdirSync(dir) } catch {}
// =============================================================
describe('ensureDir', () => {
  let warnSpy

  beforeEach(() => {
    vi.clearAllMocks()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('creates directory successfully', () => {
    expect(() => ensureDir('/tmp/new-dir')).not.toThrow()
    expect(mockMkdirSync).toHaveBeenCalledWith('/tmp/new-dir')
  })

  it('does not throw when mkdirSync fails (e.g. directory already exists)', () => {
    const eexist = Object.assign(new Error('EEXIST'), { code: 'EEXIST' })
    mockMkdirSync.mockImplementation(() => { throw eexist })

    expect(() => ensureDir('/tmp/existing-dir')).not.toThrow()
  })

  it('logs a warning when mkdirSync throws', () => {
    const eacces = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
    mockMkdirSync.mockImplementation(() => { throw eacces })

    ensureDir('/tmp/forbidden-dir')

    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls[0].join(' ')).toContain('/tmp/forbidden-dir')
  })

  it('passes recursive option to mkdirSync when requested', () => {
    ensureDir('/tmp/nested/deep/dir', { recursive: true })

    expect(mockMkdirSync).toHaveBeenCalledWith('/tmp/nested/deep/dir', { recursive: true })
  })
})
