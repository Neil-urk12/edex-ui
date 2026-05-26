import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Renderer tests need DOM environment — set via @vitest/environment or inline
// @vitest-environment jsdom

let HardwareInspector
let mockGetSystemInfo
let mockGetChassisInfo

beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()

    // Set up DOM container
    document.body.innerHTML = '<div id="test-parent"></div>'

    // Mock electronAPI on window
    mockGetSystemInfo = vi.fn()
    mockGetChassisInfo = vi.fn()
    window.electronAPI = {
        getSystemInfo: mockGetSystemInfo,
        getChassisInfo: mockGetChassisInfo,
    }

    // Import the module under test
    const mod = await import('../../../src/renderer/classes/hardwareInspector.class.js')
    HardwareInspector = mod.HardwareInspector
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    delete window.electronAPI
})

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('HardwareInspector constructor', () => {
    it('throws "Missing parameters" when parentId is missing', () => {
        expect(() => new HardwareInspector()).toThrow('Missing parameters')
    })

    it('throws "Missing parameters" when parentId is empty string', () => {
        expect(() => new HardwareInspector('')).toThrow('Missing parameters')
    })

    it('creates a DOM container with id "mod_hardwareInspector"', () => {
        new HardwareInspector('test-parent')
        const el = document.getElementById('mod_hardwareInspector')
        expect(el).not.toBeNull()
        expect(el.parentElement.id).toBe('test-parent')
    })

    it('contains inner div with id "mod_hardwareInspector_inner"', () => {
        new HardwareInspector('test-parent')
        const inner = document.getElementById('mod_hardwareInspector_inner')
        expect(inner).not.toBeNull()
    })

    it('contains h2 elements for manufacturer, model, and chassis', () => {
        new HardwareInspector('test-parent')
        expect(document.getElementById('mod_hardwareInspector_manufacturer')).not.toBeNull()
        expect(document.getElementById('mod_hardwareInspector_model')).not.toBeNull()
        expect(document.getElementById('mod_hardwareInspector_chassis')).not.toBeNull()
    })

    it('calls updateInfo on construction', () => {
        mockGetSystemInfo.mockResolvedValue({ manufacturer: 'Dell', model: 'XPS 15' })
        mockGetChassisInfo.mockResolvedValue({ type: 'Laptop' })

        const spy = vi.spyOn(HardwareInspector.prototype, 'updateInfo')
        new HardwareInspector('test-parent')
        expect(spy).toHaveBeenCalledTimes(1)
    })

    it('sets up a 20-second polling interval', () => {
        const spy = vi.spyOn(HardwareInspector.prototype, 'updateInfo')
        mockGetSystemInfo.mockResolvedValue({ manufacturer: 'Dell', model: 'XPS 15' })
        mockGetChassisInfo.mockResolvedValue({ type: 'Laptop' })

        new HardwareInspector('test-parent')
        spy.mockClear()

        // Advance 20 seconds — should trigger one additional call
        vi.advanceTimersByTime(20000)
        expect(spy).toHaveBeenCalledTimes(1)

        // Advance another 20 seconds — total 2 more calls
        vi.advanceTimersByTime(20000)
        expect(spy).toHaveBeenCalledTimes(2)
    })
})

// ---------------------------------------------------------------------------
// updateInfo
// ---------------------------------------------------------------------------

describe('HardwareInspector.updateInfo', () => {
    let instance

    beforeEach(() => {
        mockGetSystemInfo.mockResolvedValue({ manufacturer: 'Dell Inc.', model: 'XPS 15 9570' })
        mockGetChassisInfo.mockResolvedValue({ type: 'Laptop' })
        instance = new HardwareInspector('test-parent')
    })

    it('calls window.electronAPI.getSystemInfo()', () => {
        expect(mockGetSystemInfo).toHaveBeenCalled()
    })

    it('calls window.electronAPI.getChassisInfo()', () => {
        expect(mockGetChassisInfo).toHaveBeenCalled()
    })

    it('updates manufacturer DOM element with trimmed data', async () => {
        // getSystemInfo already resolved in beforeEach; flush microtasks
        await vi.advanceTimersByTimeAsync(0)

        const el = document.getElementById('mod_hardwareInspector_manufacturer')
        expect(el.innerText).toBe('Dell Inc.')
    })

    it('updates model DOM element with trimmed data filtered by manufacturer and chassis type', async () => {
        await vi.advanceTimersByTimeAsync(0)

        const el = document.getElementById('mod_hardwareInspector_model')
        // "XPS 15 9570" trimmed, filtered by manufacturer "Dell Inc." and chassis "Laptop"
        // _trimDataString removes matching words, limits to 2 words
        expect(el.innerText).not.toBe('NONE')
        expect(el.innerText).not.toBe('EDEX')
    })

    it('updates chassis DOM element', async () => {
        await vi.advanceTimersByTimeAsync(0)

        const el = document.getElementById('mod_hardwareInspector_chassis')
        expect(el.innerText).toBe('Laptop')
    })

    it('handles getSystemInfo rejection gracefully (no crash)', async () => {
        mockGetSystemInfo.mockRejectedValue(new Error('IPC failed'))
        mockGetChassisInfo.mockResolvedValue({ type: 'Desktop' })

        // Should not throw
        const freshInstance = new HardwareInspector('test-parent')
        await expect(vi.advanceTimersByTimeAsync(0)).resolves.not.toThrow()
    })

    it('handles getChassisInfo rejection gracefully (no crash)', async () => {
        mockGetSystemInfo.mockResolvedValue({ manufacturer: 'HP', model: 'EliteBook' })
        mockGetChassisInfo.mockRejectedValue(new Error('IPC failed'))

        const freshInstance = new HardwareInspector('test-parent')
        await expect(vi.advanceTimersByTimeAsync(0)).resolves.not.toThrow()
    })
})

// ---------------------------------------------------------------------------
// _trimDataString
// ---------------------------------------------------------------------------

describe('HardwareInspector._trimDataString', () => {
    let instance

    beforeEach(() => {
        mockGetSystemInfo.mockResolvedValue({ manufacturer: 'Dell', model: 'XPS' })
        mockGetChassisInfo.mockResolvedValue({ type: 'Laptop' })
        instance = new HardwareInspector('test-parent')
    })

    it('trims whitespace from input string', () => {
        expect(instance._trimDataString('  hello world  ')).toBe('hello world')
    })

    it('splits by space and filters out words matching filters', () => {
        expect(instance._trimDataString('Dell Inc. XPS 15', 'Dell', '15')).toBe('Inc. XPS')
    })

    it('limits to first 2 words after filtering', () => {
        expect(instance._trimDataString('a b c d e')).toBe('a b')
    })

    it('returns full trimmed string when no filters provided', () => {
        expect(instance._trimDataString('hello')).toBe('hello')
    })

    it('handles single-word input', () => {
        expect(instance._trimDataString('hello')).toBe('hello')
    })

    it('handles empty string', () => {
        expect(instance._trimDataString('')).toBe('')
    })

    it('filters are case-sensitive', () => {
        expect(instance._trimDataString('dell Dell DELL', 'Dell')).toBe('dell DELL')
    })

    it('handles undefined filters gracefully', () => {
        expect(instance._trimDataString('hello world', undefined)).toBe('hello world')
    })

    // --- maxWords parameter tests (Issue #3) ---

    it('accepts a numeric last argument as maxWords override', () => {
        expect(instance._trimDataString('a b c d e', 3)).toBe('a b c')
    })

    it('respects higher maxWords value', () => {
        expect(instance._trimDataString('a b c d e', 4)).toBe('a b c d')
    })

    it('combines string filters with numeric maxWords as last argument', () => {
        expect(instance._trimDataString('Dell XPS 15 9570', 'Dell', 3)).toBe('XPS 15 9570')
    })

    it('does not truncate when maxWords exceeds word count', () => {
        expect(instance._trimDataString('hello', 1)).toBe('hello')
    })

    it('returns empty string when maxWords is 0', () => {
        expect(instance._trimDataString('a b c', 0)).toBe('')
    })

    it('treats negative maxWords as 0', () => {
        expect(instance._trimDataString('hello world', -1)).toBe('')
    })

    it('returns empty string for null input', () => {
        expect(instance._trimDataString(null)).toBe('')
    })
})

// ---------------------------------------------------------------------------
// Polling / cleanup
// ---------------------------------------------------------------------------

describe('HardwareInspector polling', () => {
    it('stores interval ID for cleanup', () => {
        mockGetSystemInfo.mockResolvedValue({ manufacturer: 'Dell', model: 'XPS' })
        mockGetChassisInfo.mockResolvedValue({ type: 'Laptop' })

        const instance = new HardwareInspector('test-parent')
        expect(instance._intervalId).toBeDefined()
        expect(instance._intervalId).toBeTruthy()
    })

    it('clears interval on cleanup', () => {
        mockGetSystemInfo.mockResolvedValue({ manufacturer: 'Dell', model: 'XPS' })
        mockGetChassisInfo.mockResolvedValue({ type: 'Laptop' })

        const instance = new HardwareInspector('test-parent')
        const spy = vi.spyOn(global, 'clearInterval')

        instance.cleanup()
        expect(spy).toHaveBeenCalledWith(instance._intervalId)
    })

    it('does not poll after cleanup', async () => {
        mockGetSystemInfo.mockResolvedValue({ manufacturer: 'Dell', model: 'XPS' })
        mockGetChassisInfo.mockResolvedValue({ type: 'Laptop' })

        const instance = new HardwareInspector('test-parent')
        const updateSpy = vi.spyOn(instance, 'updateInfo')
        updateSpy.mockClear()

        instance.cleanup()

        await vi.advanceTimersByTimeAsync(60000) // 3 intervals
        expect(updateSpy).not.toHaveBeenCalled()
    })
})

// ---------------------------------------------------------------------------
// Integration: full flow
// ---------------------------------------------------------------------------

describe('HardwareInspector integration', () => {
    it('full flow: constructor -> updateInfo -> DOM updated with mocked API responses', async () => {
        mockGetSystemInfo.mockResolvedValue({
            manufacturer: 'Lenovo',
            model: 'ThinkPad X1 Carbon Gen 11',
        })
        mockGetChassisInfo.mockResolvedValue({ type: 'Notebook' })

        const instance = new HardwareInspector('test-parent')

        // Flush all promises and timers
        await vi.advanceTimersByTimeAsync(0)

        const manufacturer = document.getElementById('mod_hardwareInspector_manufacturer')
        const model = document.getElementById('mod_hardwareInspector_model')
        const chassis = document.getElementById('mod_hardwareInspector_chassis')

        // Manufacturer: "Lenovo" trimmed -> "Lenovo"
        expect(manufacturer.innerText).toBe('Lenovo')

        // Model: "ThinkPad X1 Carbon Gen 11" trimmed, filtered by manufacturer "Lenovo" and chassis "Notebook"
        // No words match filters, so first 2 words: "ThinkPad X1"
        expect(model.innerText).toBe('ThinkPad X1')

        // Chassis type directly
        expect(chassis.innerText).toBe('Notebook')
    })

    it('updates DOM on each polling cycle', async () => {
        let systemCallCount = 0
        let chassisCallCount = 0
        mockGetSystemInfo.mockImplementation(() => {
            systemCallCount++
            return Promise.resolve({
                manufacturer: systemCallCount === 1 ? 'Dell Inc.' : 'HP',
                model: systemCallCount === 1 ? 'XPS 15 9570' : 'EliteBook 840',
            })
        })
        mockGetChassisInfo.mockImplementation(() => {
            chassisCallCount++
            return Promise.resolve({ type: chassisCallCount === 1 ? 'Laptop' : 'Notebook' })
        })

        new HardwareInspector('test-parent')
        await vi.advanceTimersByTimeAsync(0)

        // First poll happened in constructor
        expect(document.getElementById('mod_hardwareInspector_manufacturer').innerText).toBe('Dell Inc.')
        expect(document.getElementById('mod_hardwareInspector_chassis').innerText).toBe('Laptop')

        // Trigger second poll
        vi.advanceTimersByTime(20000)
        await vi.advanceTimersByTimeAsync(0)

        expect(document.getElementById('mod_hardwareInspector_manufacturer').innerText).toBe('HP')
        expect(document.getElementById('mod_hardwareInspector_chassis').innerText).toBe('Notebook')
    })
})
