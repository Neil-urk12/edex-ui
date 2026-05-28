// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal DOM + window mocks for constructor validation tests
beforeEach(() => {
  document.body.innerHTML = '<div id="left"></div><div id="term0"></div>';
  window.electronAPI = {
    getCpuInfo: vi.fn().mockResolvedValue({ cores: 4, manufacturer: 'Intel', brand: 'i7', speed: 3.0, speedMax: 4.0 }),
    getCpuLoad: vi.fn().mockResolvedValue({ cpus: [{ load: 50 }] }),
    getCpuTemperature: vi.fn().mockResolvedValue({ max: 60 }),
    getProcesses: vi.fn().mockResolvedValue({ all: 100 }),
    getSystemInfo: vi.fn().mockResolvedValue({ manufacturer: 'Dell', model: 'XPS' }),
    getChassisInfo: vi.fn().mockResolvedValue({ type: 'desktop' }),
    getMemoryInfo: vi.fn().mockResolvedValue({ total: 8e9, used: 4e9, free: 4e9, active: 3e9, available: 5e9, swapused: 0, swaptotal: 1e9 }),
    getSystemUptime: vi.fn().mockResolvedValue(3600),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue(null),
    watchDirectory: vi.fn().mockResolvedValue(undefined),
    onCwdChanged: vi.fn().mockReturnValue(() => {}),
    onFsChanged: vi.fn().mockReturnValue(() => {}),
    createTerminal: vi.fn().mockResolvedValue(0),
    writeTerminal: vi.fn(),
    resizeTerminal: vi.fn(),
    onTerminalData: vi.fn().mockReturnValue(() => {}),
    onTerminalExit: vi.fn().mockReturnValue(() => {}),
    onProcessChanged: vi.fn().mockReturnValue(() => {}),
  };
  window.settings = { hideDotfiles: false, fsListView: false, termFontSize: 15, settingsDir: '/tmp', themesPath: '/tmp/themes', kbLayoutPath: '/tmp/keyboards' };
  window.theme = { r: '0', g: '255', b: '255', colors: { r: '0', g: '255', b: '255', black: '#000', light_black: '#111', grey: '#888', red: 'red', yellow: 'yellow' }, terminal: { fontFamily: 'monospace', foreground: '#fff', background: '#000', cursor: '#fff', cursorAccent: '#000', selection: 'rgba(255,255,255,0.3)' } };
  window.keyboard = { detach: vi.fn(), attach: vi.fn() };
  window.term = {};
  window.audioManager = { folder: { play: vi.fn() } };
  window.passwordMode = 'false';
  window.isTermFilterValidated = undefined;
});

describe('Constructor error types — throws Error, not string', () => {
  it('RAMwatcher throws Error when parentId missing', async () => {
    const { RAMwatcher } = await import('../../../src/renderer/classes/ramwatcher.class.js');
    expect(() => new RAMwatcher(null)).toThrow(Error);
  });

  it('FilesystemDisplay throws Error when parentId missing', async () => {
    const { FilesystemDisplay } = await import('../../../src/renderer/classes/filesystem.class.js');
    expect(() => new FilesystemDisplay(null)).toThrow(Error);
  });

  it('Sysinfo throws Error when parentId missing', async () => {
    const { Sysinfo } = await import('../../../src/renderer/classes/sysinfo.class.js');
    expect(() => new Sysinfo(null)).toThrow(Error);
  });

  it('Terminal throws Error when options empty', async () => {
    const { Terminal } = await import('../../../src/renderer/classes/terminal.class.js');
    expect(() => new Terminal({})).toThrow(Error);
  });

  // Regression: these already throw proper Errors
  it('Cpuinfo throws Error when parentId missing', async () => {
    const { Cpuinfo } = await import('../../../src/renderer/classes/cpuinfo.class.js');
    expect(() => new Cpuinfo(null)).toThrow(Error);
  });

  it('HardwareInspector throws Error when parentId missing', async () => {
    const { HardwareInspector } = await import('../../../src/renderer/classes/hardwareInspector.class.js');
    expect(() => new HardwareInspector(null)).toThrow(Error);
  });

  it('Clock throws Error when parentId missing', async () => {
    const { Clock } = await import('../../../src/renderer/classes/clock.class.js');
    expect(() => new Clock(null)).toThrow(Error);
  });

  it('Keyboard throws Error when options missing', async () => {
    const { Keyboard } = await import('../../../src/renderer/classes/keyboard.class.js');
    expect(() => new Keyboard({})).toThrow(Error);
  });

  it('Keyboard throws Error when container missing', async () => {
    const { Keyboard } = await import('../../../src/renderer/classes/keyboard.class.js');
    expect(() => new Keyboard({ layout: 'us' })).toThrow(Error);
  });
});
