// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Tests for cleanup method standardization to `dispose()`.
//
// After the Phase 1 refactor, every UI class MUST expose a `dispose()` method
// that clears all intervals / event listeners and tears down the DOM subtree.
//
// Current state (pre-refactor):
//   Cpuinfo.cleanup()          -- has cleanup, not dispose
//   HardwareInspector.cleanup() -- has cleanup, not dispose
//   Clock                      -- no cleanup at all
//   Sysinfo                    -- no cleanup at all
//   RAMwatcher                 -- no cleanup at all
//
// These tests WILL FAIL until the refactor renames / adds `dispose()`.
// ---------------------------------------------------------------------------

let parentElement;
let mockElectronAPI;

beforeEach(() => {
    vi.useFakeTimers();

    parentElement = document.createElement('div');
    parentElement.setAttribute('id', 'test-parent');
    document.body.appendChild(parentElement);

    mockElectronAPI = {
        getCpuInfo: vi.fn().mockResolvedValue({
            cores: 4,
            manufacturer: 'Intel',
            brand: 'Core i7',
            speed: 2.6,
            speedMax: 4.5,
        }),
        getCpuLoad: vi.fn().mockResolvedValue({
            cpus: [{ load: 50 }, { load: 60 }, { load: 40 }, { load: 30 }],
        }),
        getCpuTemperature: vi.fn().mockResolvedValue({ max: 65 }),
        getProcesses: vi.fn().mockResolvedValue({ all: 200 }),
        getSystemInfo: vi.fn().mockResolvedValue({
            manufacturer: 'Dell',
            model: 'XPS 15',
        }),
        getChassisInfo: vi.fn().mockResolvedValue({ type: 'Laptop' }),
        getMemoryInfo: vi.fn().mockResolvedValue({
            total: 16000000000,
            active: 8000000000,
            available: 4000000000,
            free: 2000000000,
            swaptotal: 8000000000,
            swapused: 1000000000,
        }),
        getSystemUptime: vi.fn().mockResolvedValue(3600),
    };
    window.electronAPI = mockElectronAPI;
    window.settings = { clockHours: 24 };
});

afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete window.electronAPI;
    delete window.settings;
});

// ---- Cpuinfo ----

describe('Cpuinfo dispose', () => {
    it('exposes a dispose method (not cleanup)', async () => {
        const { Cpuinfo } = await import('../../../src/renderer/classes/cpuinfo.class.js');
        const instance = new Cpuinfo('test-parent');
        await vi.advanceTimersByTimeAsync(0);

        expect(typeof instance.dispose).toBe('function');
    });

    it('clears all polling intervals when dispose is called', async () => {
        const { Cpuinfo } = await import('../../../src/renderer/classes/cpuinfo.class.js');
        const instance = new Cpuinfo('test-parent');
        await vi.advanceTimersByTimeAsync(0);

        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

        instance.dispose();

        expect(clearIntervalSpy).toHaveBeenCalledWith(instance.loadUpdater);
        expect(clearIntervalSpy).toHaveBeenCalledWith(instance.speedUpdater);
        expect(clearIntervalSpy).toHaveBeenCalledWith(instance.tasksUpdater);
        // tempUpdater uses a 2000ms interval
        expect(clearIntervalSpy).toHaveBeenCalledWith(instance.tempUpdater);

        clearIntervalSpy.mockRestore();
    });

    it('stops polling after dispose is called', async () => {
        const { Cpuinfo } = await import('../../../src/renderer/classes/cpuinfo.class.js');
        const instance = new Cpuinfo('test-parent');
        await vi.advanceTimersByTimeAsync(0);

        // Reset call counts from constructor
        mockElectronAPI.getCpuLoad.mockClear();
        mockElectronAPI.getCpuInfo.mockClear();

        instance.dispose();

        // Advance past multiple polling intervals
        await vi.advanceTimersByTimeAsync(10000);

        expect(mockElectronAPI.getCpuLoad).not.toHaveBeenCalled();
        expect(mockElectronAPI.getCpuInfo).not.toHaveBeenCalled();
    });
});

// ---- HardwareInspector ----

describe('HardwareInspector dispose', () => {
    it('exposes a dispose method (not cleanup)', async () => {
        const { HardwareInspector } = await import('../../../src/renderer/classes/hardwareInspector.class.js');
        const instance = new HardwareInspector('test-parent');

        expect(typeof instance.dispose).toBe('function');
    });

    it('clears interval when dispose is called', async () => {
        const { HardwareInspector } = await import('../../../src/renderer/classes/hardwareInspector.class.js');
        const instance = new HardwareInspector('test-parent');
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

        instance.dispose();

        expect(clearIntervalSpy).toHaveBeenCalledWith(instance._intervalId);
        clearIntervalSpy.mockRestore();
    });

    it('stops polling after dispose is called', async () => {
        const { HardwareInspector } = await import('../../../src/renderer/classes/hardwareInspector.class.js');
        const instance = new HardwareInspector('test-parent');
        const updateSpy = vi.spyOn(instance, 'updateInfo');
        updateSpy.mockClear();

        instance.dispose();

        await vi.advanceTimersByTimeAsync(60000);
        expect(updateSpy).not.toHaveBeenCalled();
    });
});

// ---- Clock ----

describe('Clock dispose', () => {
    it('exposes a dispose method', async () => {
        const { Clock } = await import('../../../src/renderer/classes/clock.class.js');
        const instance = new Clock('test-parent');

        expect(typeof instance.dispose).toBe('function');
    });

    it('clears the updater interval when dispose is called', async () => {
        const { Clock } = await import('../../../src/renderer/classes/clock.class.js');
        const instance = new Clock('test-parent');
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

        instance.dispose();

        expect(clearIntervalSpy).toHaveBeenCalledWith(instance.updater);
        clearIntervalSpy.mockRestore();
    });

    it('stops updating the clock DOM after dispose', async () => {
        const { Clock } = await import('../../../src/renderer/classes/clock.class.js');
        const instance = new Clock('test-parent');

        instance.dispose();

        const clockText = document.getElementById('mod_clock_text');
        const before = clockText?.innerHTML;

        // Advance 10 seconds -- clock would normally change every 1s
        vi.advanceTimersByTime(10000);

        // DOM should not have been updated
        expect(clockText?.innerHTML).toBe(before);
    });
});

// ---- Sysinfo ----

describe('Sysinfo dispose', () => {
    it('exposes a dispose method', async () => {
        const { Sysinfo } = await import('../../../src/renderer/classes/sysinfo.class.js');
        const instance = new Sysinfo('test-parent');

        expect(typeof instance.dispose).toBe('function');
    });

    it('clears all intervals when dispose is called', async () => {
        const { Sysinfo } = await import('../../../src/renderer/classes/sysinfo.class.js');
        const instance = new Sysinfo('test-parent');
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

        instance.dispose();

        expect(clearIntervalSpy).toHaveBeenCalledWith(instance.uptimeUpdater);
        expect(clearIntervalSpy).toHaveBeenCalledWith(instance.batteryUpdater);
        clearIntervalSpy.mockRestore();
    });

    it('stops polling after dispose is called', async () => {
        const { Sysinfo } = await import('../../../src/renderer/classes/sysinfo.class.js');
        const instance = new Sysinfo('test-parent');

        instance.dispose();

        mockElectronAPI.getSystemUptime.mockClear();

        // Advance past the 60s uptime polling interval
        await vi.advanceTimersByTimeAsync(120000);
        expect(mockElectronAPI.getSystemUptime).not.toHaveBeenCalled();
    });
});

// ---- RAMwatcher ----

describe('RAMwatcher dispose', () => {
    it('exposes a dispose method', async () => {
        const { RAMwatcher } = await import('../../../src/renderer/classes/ramwatcher.class.js');
        const instance = new RAMwatcher('test-parent');
        await vi.advanceTimersByTimeAsync(0);

        expect(typeof instance.dispose).toBe('function');
    });

    it('clears the infoUpdater interval when dispose is called', async () => {
        const { RAMwatcher } = await import('../../../src/renderer/classes/ramwatcher.class.js');
        const instance = new RAMwatcher('test-parent');
        await vi.advanceTimersByTimeAsync(0);

        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

        instance.dispose();

        expect(clearIntervalSpy).toHaveBeenCalledWith(instance.infoUpdater);
        clearIntervalSpy.mockRestore();
    });

    it('stops polling after dispose is called', async () => {
        const { RAMwatcher } = await import('../../../src/renderer/classes/ramwatcher.class.js');
        const instance = new RAMwatcher('test-parent');
        await vi.advanceTimersByTimeAsync(0);

        mockElectronAPI.getMemoryInfo.mockClear();

        instance.dispose();

        // Advance past the 1500ms polling interval multiple times
        await vi.advanceTimersByTimeAsync(10000);
        expect(mockElectronAPI.getMemoryInfo).not.toHaveBeenCalled();
    });
});
