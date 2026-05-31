// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Mock xterm and addons — use vi.hoisted so mocks exist when vi.mock factories run
const { mockTerminalInstance } = vi.hoisted(() => ({
    mockTerminalInstance: {
        cols: 80,
        rows: 24,
        open: vi.fn(),
        write: vi.fn(),
        focus: vi.fn(),
        dispose: vi.fn(),
        onData: vi.fn(),
        onBinary: vi.fn(),
        loadAddon: vi.fn(),
        attachCustomKeyEventHandler: vi.fn(),
        scrollLines: vi.fn(),
        hasSelection: vi.fn().mockReturnValue(false),
        getSelection: vi.fn().mockReturnValue(''),
        clearSelection: vi.fn(),
        resize: vi.fn(),
    },
}));

const { mockFitAddonInstance } = vi.hoisted(() => ({
    mockFitAddonInstance: {
        proposeDimensions: vi.fn().mockReturnValue({ cols: 80, rows: 24 }),
        fit: vi.fn(),
        dispose: vi.fn(),
    },
}));

const { mockWebglAddonInstance } = vi.hoisted(() => ({
    mockWebglAddonInstance: {
        dispose: vi.fn(),
    },
}));

vi.mock('xterm', () => ({
    Terminal: vi.fn().mockImplementation(function() { return mockTerminalInstance; }),
}));

vi.mock('xterm-addon-fit', () => ({
    FitAddon: vi.fn().mockImplementation(function() { return mockFitAddonInstance; }),
}));

vi.mock('xterm-addon-webgl', () => ({
    WebglAddon: vi.fn().mockImplementation(function() { return mockWebglAddonInstance; }),
}));

vi.mock('../../../src/renderer/state.js', () => ({
    getSetting: (key, defaultValue) => window.settings[key] ?? defaultValue,
}));

vi.mock('color', () => {
    const filterMethods = [
        'negate', 'grayscale', 'lighten', 'darken',
        'saturate', 'desaturate', 'whiten', 'blacken',
        'fade', 'opaquer', 'rotate'
    ];
    const chainable = () => {
        const c = {
            mix: vi.fn().mockReturnThis(),
            hex: vi.fn().mockReturnValue('#888888'),
        };
        for (const m of filterMethods) {
            c[m] = vi.fn().mockReturnThis();
        }
        return c;
    };
    return { default: vi.fn().mockReturnValue(chainable()) };
});

import { Terminal } from '../../../src/renderer/classes/terminal.class.js';
import { Terminal as XtermTerminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebglAddon } from 'xterm-addon-webgl';

describe('Terminal', () => {
    let parentElement;
    let mockElectronAPI;

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset mock instance state
        mockTerminalInstance.cols = 80;
        mockTerminalInstance.rows = 24;
        mockTerminalInstance.hasSelection.mockReturnValue(false);
        mockTerminalInstance.getSelection.mockReturnValue('');
        mockFitAddonInstance.proposeDimensions.mockReturnValue({ cols: 80, rows: 24 });

        // Create parent DOM element
        parentElement = document.createElement('div');
        parentElement.setAttribute('id', 'test-parent');
        document.body.appendChild(parentElement);

        // Add a mock xterm-helper-textarea that the constructor queries
        const textarea = document.createElement('textarea');
        textarea.className = 'xterm-helper-textarea';
        parentElement.appendChild(textarea);

        // Mock electronAPI
        mockElectronAPI = {
            createTerminal: vi.fn(),
            writeTerminal: vi.fn(),
            resizeTerminal: vi.fn(),
            setClipboardText: vi.fn().mockResolvedValue(undefined),
            getClipboardText: vi.fn().mockResolvedValue('clipboard text'),
            onTerminalData: vi.fn().mockReturnValue(() => {}),
            onTerminalExit: vi.fn().mockReturnValue(() => {}),
            onCwdChanged: vi.fn().mockReturnValue(() => {}),
            onProcessChanged: vi.fn().mockReturnValue(() => {}),
        };
        window.electronAPI = mockElectronAPI;

        // Mock window globals the constructor depends on
        window.theme = {
            r: 100,
            g: 200,
            b: 150,
            terminal: {
                foreground: '#ffffff',
                background: '#000000',
                cursor: '#ffffff',
                cursorAccent: '#000000',
                selection: 'rgba(255,255,255,0.3)',
                fontFamily: 'Fira Mono',
                fontSize: 15,
                fontWeight: 'normal',
                fontWeightBold: 'bold',
                letterSpacing: 0,
                lineHeight: 1,
                cursorBlink: true,
                cursorStyle: 'block',
                allowTransparency: false,
            },
            colors: {},
        };
        window.settings = {
            termFontSize: 15,
            allowWindowed: false,
            experimentalGlobeFeatures: false,
        };
        window.keyboard = { keydownHandler: vi.fn() };
        window.audioManager = { stdout: { play: vi.fn() } };
        window.passwordMode = 'false';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.electronAPI;
        delete window.theme;
        delete window.settings;
        delete window.keyboard;
        delete window.audioManager;
        delete window.passwordMode;
        delete window.isTermFilterValidated;
        delete window.mods;
        delete window.toggleFullScreen;
    });

    describe('constructor', () => {
        it('throws "Missing options" when opts.id is undefined', () => {
            expect(() => new Terminal({ parentId: 'test-parent' })).toThrow('Missing options');
        });

        it('throws "Missing options" when opts.parentId is missing', () => {
            expect(() => new Terminal({ id: 0 })).toThrow('Missing options');
        });

        it('throws "Missing options" when no opts provided', () => {
            expect(() => new Terminal()).toThrow();
        });

        it('creates an xterm Terminal instance', () => {
            new Terminal({ id: 0, parentId: 'test-parent' });
            expect(XtermTerminal).toHaveBeenCalled();
        });

        it('opens terminal in the DOM element matching parentId', () => {
            new Terminal({ id: 0, parentId: 'test-parent' });
            expect(mockTerminalInstance.open).toHaveBeenCalledWith(parentElement);
        });

        it('loads FitAddon', () => {
            new Terminal({ id: 0, parentId: 'test-parent' });
            expect(FitAddon).toHaveBeenCalled();
            expect(mockTerminalInstance.loadAddon).toHaveBeenCalledWith(expect.any(Object));
        });

        it('loads WebglAddon', () => {
            new Terminal({ id: 0, parentId: 'test-parent' });
            expect(WebglAddon).toHaveBeenCalled();
        });

        it('calls electronAPI.createTerminal with terminal id', () => {
            new Terminal({ id: 42, parentId: 'test-parent' });
            expect(mockElectronAPI.createTerminal).toHaveBeenCalledWith({
                id: 42,
                shell: undefined,
                params: undefined,
                cwd: undefined,
            });
        });

        it('sets id from opts', () => {
            const term = new Terminal({ id: 7, parentId: 'test-parent' });
            expect(term.id).toBe(7);
        });

        it('focuses the terminal', () => {
            new Terminal({ id: 0, parentId: 'test-parent' });
            expect(mockTerminalInstance.focus).toHaveBeenCalled();
        });

        it('registers onData handler that writes to electronAPI', () => {
            new Terminal({ id: 0, parentId: 'test-parent' });

            // Simulate user typing by invoking the onData callback
            const onDataCallback = mockTerminalInstance.onData.mock.calls[0][0];
            onDataCallback('ls -la\r');

            expect(mockElectronAPI.writeTerminal).toHaveBeenCalledWith(0, 'ls -la\r');
        });
    });

    describe('write', () => {
        it('calls electronAPI.writeTerminal with id and command', () => {
            const term = new Terminal({ id: 3, parentId: 'test-parent' });
            term.write('echo hello');
            expect(mockElectronAPI.writeTerminal).toHaveBeenCalledWith(3, 'echo hello');
        });
    });

    describe('writelr', () => {
        it('appends \\r to command and calls electronAPI.writeTerminal', () => {
            const term = new Terminal({ id: 3, parentId: 'test-parent' });
            term.writelr('echo hello');
            expect(mockElectronAPI.writeTerminal).toHaveBeenCalledWith(3, 'echo hello\r');
        });
    });

    describe('resize', () => {
        it('calls term.resize with cols and rows', () => {
            const term = new Terminal({ id: 0, parentId: 'test-parent' });
            term.resize(120, 40);
            expect(mockTerminalInstance.resize).toHaveBeenCalledWith(120, 40);
        });

        it('calls electronAPI.resizeTerminal with id, cols, rows', () => {
            const term = new Terminal({ id: 5, parentId: 'test-parent' });
            term.resize(120, 40);
            expect(mockElectronAPI.resizeTerminal).toHaveBeenCalledWith(5, 120, 40);
        });
    });

    describe('clipboard', () => {
        describe('copy', () => {
            it('returns false when terminal has no selection', async () => {
                mockTerminalInstance.hasSelection.mockReturnValue(false);
                const term = new Terminal({ id: 0, parentId: 'test-parent' });
                const result = await term.clipboard.copy();
                expect(result).toBe(false);
            });

            it('copies selected text to clipboard and clears selection', async () => {
                mockTerminalInstance.hasSelection.mockReturnValue(true);
                mockTerminalInstance.getSelection.mockReturnValue('selected text');
                const term = new Terminal({ id: 0, parentId: 'test-parent' });

                await term.clipboard.copy();

                expect(mockElectronAPI.setClipboardText).toHaveBeenCalledWith('selected text');
                expect(mockTerminalInstance.clearSelection).toHaveBeenCalled();
                expect(term.clipboard.didCopy).toBe(true);
            });
        });

        describe('paste', () => {
            it('gets clipboard text and writes it to terminal', async () => {
                mockElectronAPI.getClipboardText.mockResolvedValue('pasted text');
                const term = new Terminal({ id: 2, parentId: 'test-parent' });

                await term.clipboard.paste();

                expect(mockElectronAPI.getClipboardText).toHaveBeenCalled();
                expect(mockElectronAPI.writeTerminal).toHaveBeenCalledWith(2, 'pasted text');
            });

            it('sets didCopy to false after paste', async () => {
                const term = new Terminal({ id: 0, parentId: 'test-parent' });
                term.clipboard.didCopy = true;
                await term.clipboard.paste();
                expect(term.clipboard.didCopy).toBe(false);
            });
        });
    });

    describe('destroy', () => {
        it('calls term.dispose', () => {
            const term = new Terminal({ id: 0, parentId: 'test-parent' });
            term.destroy();
            expect(mockTerminalInstance.dispose).toHaveBeenCalled();
        });

        it('calls all registered unsubscribe functions', () => {
            const unsub1 = vi.fn();
            const unsub2 = vi.fn();
            mockElectronAPI.onTerminalData.mockReturnValue(unsub1);
            mockElectronAPI.onTerminalExit.mockReturnValue(unsub2);

            const term = new Terminal({ id: 0, parentId: 'test-parent' });
            term.destroy();

            expect(unsub1).toHaveBeenCalled();
            expect(unsub2).toHaveBeenCalled();
        });

        it('clears the _unsubs array after cleanup', () => {
            const term = new Terminal({ id: 0, parentId: 'test-parent' });
            term.destroy();
            expect(term._unsubs).toEqual([]);
        });
    });

    describe('IPC event callbacks', () => {
        it('registers onTerminalData listener', () => {
            new Terminal({ id: 0, parentId: 'test-parent' });
            expect(mockElectronAPI.onTerminalData).toHaveBeenCalled();
        });

        it('registers onTerminalExit listener', () => {
            new Terminal({ id: 0, parentId: 'test-parent' });
            expect(mockElectronAPI.onTerminalExit).toHaveBeenCalled();
        });

        it('registers onCwdChanged listener', () => {
            new Terminal({ id: 0, parentId: 'test-parent' });
            expect(mockElectronAPI.onCwdChanged).toHaveBeenCalled();
        });

        it('registers onProcessChanged listener', () => {
            new Terminal({ id: 0, parentId: 'test-parent' });
            expect(mockElectronAPI.onProcessChanged).toHaveBeenCalled();
        });

        it('fires oncwdchange callback when IPC sends matching id', () => {
            const cwdCallback = vi.fn();
            mockElectronAPI.onCwdChanged.mockImplementation((cb) => {
                // Store callback for later invocation in test
                mockElectronAPI._cwdCallback = cb;
                return () => {};
            });

            const term = new Terminal({ id: 1, parentId: 'test-parent' });
            term.oncwdchange = cwdCallback;

            // Simulate IPC event
            mockElectronAPI._cwdCallback(1, '/home/user');

            expect(cwdCallback).toHaveBeenCalledWith('/home/user');
            expect(term.cwd).toBe('/home/user');
        });

        it('does not fire oncwdchange for different terminal id', () => {
            const cwdCallback = vi.fn();
            mockElectronAPI.onCwdChanged.mockImplementation((cb) => {
                mockElectronAPI._cwdCallback = cb;
                return () => {};
            });

            const term = new Terminal({ id: 1, parentId: 'test-parent' });
            term.oncwdchange = cwdCallback;

            mockElectronAPI._cwdCallback(99, '/other/path');

            expect(cwdCallback).not.toHaveBeenCalled();
        });

        it('fires onprocesschange callback when IPC sends matching id', () => {
            const processCallback = vi.fn();
            mockElectronAPI.onProcessChanged.mockImplementation((cb) => {
                mockElectronAPI._processCallback = cb;
                return () => {};
            });

            const term = new Terminal({ id: 1, parentId: 'test-parent' });
            term.onprocesschange = processCallback;

            mockElectronAPI._processCallback(1, 'bash');

            expect(processCallback).toHaveBeenCalledWith('bash');
        });

        it('does not fire onprocesschange for different terminal id', () => {
            const processCallback = vi.fn();
            mockElectronAPI.onProcessChanged.mockImplementation((cb) => {
                mockElectronAPI._processCallback = cb;
                return () => {};
            });

            const term = new Terminal({ id: 1, parentId: 'test-parent' });
            term.onprocesschange = processCallback;

            mockElectronAPI._processCallback(99, 'vim');

            expect(processCallback).not.toHaveBeenCalled();
        });

        it('fires onclose callback when terminal exit IPC fires for matching id', () => {
            const closeCallback = vi.fn();
            mockElectronAPI.onTerminalExit.mockImplementation((cb) => {
                mockElectronAPI._exitCallback = cb;
                return () => {};
            });

            const term = new Terminal({ id: 1, parentId: 'test-parent' });
            term.onclose = closeCallback;

            mockElectronAPI._exitCallback(1, 0, null);

            expect(closeCallback).toHaveBeenCalled();
        });

        it('plays stdout sound when passwordMode is string "false"', () => {
            window.passwordMode = "false";
            // Create a Terminal and get the onTerminalData callback that was registered
            const term = new Terminal({ id: 0, parentId: 'test-parent' });
            const dataCallback = mockElectronAPI.onTerminalData.mock.calls[
                mockElectronAPI.onTerminalData.mock.calls.length - 1
            ][0];
            // Reset throttle
            term.lastSoundFX = 0;
            dataCallback(0, 'some output');
            expect(window.audioManager.stdout.play).toHaveBeenCalled();
        });

        it('plays stdout sound when passwordMode is undefined (default)', () => {
            window.passwordMode = undefined;
            const term = new Terminal({ id: 0, parentId: 'test-parent' });
            const dataCallback = mockElectronAPI.onTerminalData.mock.calls[
                mockElectronAPI.onTerminalData.mock.calls.length - 1
            ][0];
            term.lastSoundFX = 0;
            dataCallback(0, 'some output');
            expect(window.audioManager.stdout.play).toHaveBeenCalled();
        });

        it('does NOT play stdout sound when passwordMode is string "true"', () => {
            window.passwordMode = "true";
            const term = new Terminal({ id: 0, parentId: 'test-parent' });
            const dataCallback = mockElectronAPI.onTerminalData.mock.calls[
                mockElectronAPI.onTerminalData.mock.calls.length - 1
            ][0];
            term.lastSoundFX = 0;
            dataCallback(0, 'some output');
            expect(window.audioManager.stdout.play).not.toHaveBeenCalled();
        });
    });

    describe('fit', () => {
        it('calls proposeDimensions and uses result', () => {
            mockFitAddonInstance.proposeDimensions.mockReturnValue({ cols: 100, rows: 50 });
            // Screen 1920x1080 -> GCD=120, no correction. Default x=1, y=0. cols=100+1=101, rows=50+0=50
            Object.defineProperty(window, 'screen', { value: { width: 1920, height: 1080 }, writable: true, configurable: true });
            const term = new Terminal({ id: 0, parentId: 'test-parent' });
            mockTerminalInstance.resize.mockClear();
            term.fit();
            expect(mockFitAddonInstance.proposeDimensions).toHaveBeenCalled();
            expect(mockTerminalInstance.resize).toHaveBeenCalledWith(101, 50);
        });

        it('applies GCD 100 correction: y=1, x=3', () => {
            mockFitAddonInstance.proposeDimensions.mockReturnValue({ cols: 80, rows: 24 });
            // 1600x900 -> GCD=100 -> x=3, y=1; fontSize=15. cols=80+3=83, rows=24+1=25
            Object.defineProperty(window, 'screen', { value: { width: 1600, height: 900 }, writable: true, configurable: true });
            const term = new Terminal({ id: 0, parentId: 'test-parent' });
            mockTerminalInstance.resize.mockClear();
            term.fit();
            expect(mockTerminalInstance.resize).toHaveBeenCalledWith(83, 25);
        });

        it('applies GCD 256 correction: x=2', () => {
            mockFitAddonInstance.proposeDimensions.mockReturnValue({ cols: 80, rows: 24 });
            // 1280x768 -> GCD=256 -> x=2, y=0; fontSize=15. cols=80+2=82, rows=24+0=24
            Object.defineProperty(window, 'screen', { value: { width: 1280, height: 768 }, writable: true, configurable: true });
            const term = new Terminal({ id: 0, parentId: 'test-parent' });
            mockTerminalInstance.resize.mockClear();
            term.fit();
            expect(mockTerminalInstance.resize).toHaveBeenCalledWith(82, 24);
        });

        it('decrements y when termFontSize < 15', () => {
            mockFitAddonInstance.proposeDimensions.mockReturnValue({ cols: 80, rows: 24 });
            // 1600x900 -> GCD=100 -> x=3, y=1; fontSize=10 -> y=1-1=0. cols=83, rows=24
            Object.defineProperty(window, 'screen', { value: { width: 1600, height: 900 }, writable: true, configurable: true });
            window.settings.termFontSize = 10;
            const term = new Terminal({ id: 0, parentId: 'test-parent' });
            mockTerminalInstance.resize.mockClear();
            term.fit();
            expect(mockTerminalInstance.resize).toHaveBeenCalledWith(83, 24);
        });

        it('skips resize when cols and rows are unchanged', () => {
            mockFitAddonInstance.proposeDimensions.mockReturnValue({ cols: 80, rows: 24 });
            // Screen 1920x1080 -> GCD=120, x=1, y=0. cols=81, rows=24.
            // Set mock terminal to already have those dimensions so resize is skipped.
            Object.defineProperty(window, 'screen', { value: { width: 1920, height: 1080 }, writable: true, configurable: true });
            const term = new Terminal({ id: 0, parentId: 'test-parent' });
            mockTerminalInstance.cols = 81;
            mockTerminalInstance.rows = 24;
            mockTerminalInstance.resize.mockClear();
            term.fit();
            expect(mockTerminalInstance.resize).not.toHaveBeenCalled();
        });

        it('updates lastRefit timestamp', () => {
            mockFitAddonInstance.proposeDimensions.mockReturnValue({ cols: 80, rows: 24 });
            Object.defineProperty(window, 'screen', { value: { width: 1920, height: 1080 }, writable: true, configurable: true });
            const term = new Terminal({ id: 0, parentId: 'test-parent' });
            mockTerminalInstance.resize.mockClear();
            const before = Date.now();
            term.fit();
            const after = Date.now();
            expect(term.lastRefit).toBeGreaterThanOrEqual(before);
            expect(term.lastRefit).toBeLessThanOrEqual(after);
        });
    });

    describe('color filter', () => {
        describe('valid filter parsing', () => {
            it('parses negate filter and sets isTermFilterValidated', () => {
                window.theme.terminal.colorFilter = ['negate'];
                new Terminal({ id: 0, parentId: 'test-parent' });
                expect(window.isTermFilterValidated).toBe(true);
                // Parsed in-place: string replaced with {func, arg}
                expect(window.theme.terminal.colorFilter[0]).toEqual({ func: 'negate', arg: [] });
            });

            it('parses grayscale filter (no-arg)', () => {
                window.theme.terminal.colorFilter = ['grayscale'];
                new Terminal({ id: 0, parentId: 'test-parent' });
                expect(window.theme.terminal.colorFilter[0]).toEqual({ func: 'grayscale', arg: [] });
            });

            it.each([
                'lighten', 'darken', 'saturate', 'desaturate',
                'whiten', 'blacken', 'fade', 'opaquer', 'rotate', 'mix'
            ])('parses %s filter with numeric arg', (fn) => {
                window.theme.terminal.colorFilter = [`${fn}(0.5)`];
                new Terminal({ id: 0, parentId: 'test-parent' });
                expect(window.theme.terminal.colorFilter[0]).toEqual({ func: fn, arg: [0.5] });
                expect(window.isTermFilterValidated).toBe(true);
            });

            it('parses multiple filters in sequence', () => {
                window.theme.terminal.colorFilter = ['lighten(0.2)', 'saturate(0.8)', 'mix(0.5)'];
                new Terminal({ id: 0, parentId: 'test-parent' });
                expect(window.theme.terminal.colorFilter[0]).toEqual({ func: 'lighten', arg: [0.2] });
                expect(window.theme.terminal.colorFilter[1]).toEqual({ func: 'saturate', arg: [0.8] });
                expect(window.theme.terminal.colorFilter[2]).toEqual({ func: 'mix', arg: [0.5] });
            });
        });

        describe('invalid filter rejection', () => {
            it('rejects unknown filter function name', () => {
                window.theme.terminal.colorFilter = ['invalidFunc(0.5)'];
                new Terminal({ id: 0, parentId: 'test-parent' });
                // doCustomFilter = false, falls back to default
                // isTermFilterValidated should NOT be set
                expect(window.isTermFilterValidated).toBeUndefined();
            });

            it('rejects filters with non-numeric arg', () => {
                window.theme.terminal.colorFilter = ['lighten(abc)'];
                new Terminal({ id: 0, parentId: 'test-parent' });
                // Number('abc') is NaN, typeof NaN === 'number' is true
                // This is a bug — NaN should NOT pass the typeof check
                // Correct behavior: validation should fail
                expect(window.isTermFilterValidated).toBeUndefined();
                // Filter should NOT be parsed into an object
                expect(window.theme.terminal.colorFilter[0]).toBe('lighten(abc)');
            });

            it('rejects filters with NaN-producing arg', () => {
                window.theme.terminal.colorFilter = ['lighten(abc)'];
                new Terminal({ id: 0, parentId: 'test-parent' });
                expect(window.isTermFilterValidated).toBeUndefined();
            });

            it('one invalid filter in sequence invalidates all (every() short-circuits)', () => {
                window.theme.terminal.colorFilter = ['lighten(0.2)', 'bogus(0.5)'];
                new Terminal({ id: 0, parentId: 'test-parent' });
                // First filter parsed, second fails → every returns false
                // doCustomFilter = false, default fallback used
                expect(window.isTermFilterValidated).toBeUndefined();
            });

            it('rejects filter with Infinity arg', () => {
                window.theme.terminal.colorFilter = ['lighten(Infinity)'];
                new Terminal({ id: 0, parentId: 'test-parent' });
                expect(window.isTermFilterValidated).toBeUndefined();
            });

            it('accepts filter with negative numeric arg', () => {
                window.theme.terminal.colorFilter = ['lighten(-0.5)'];
                new Terminal({ id: 0, parentId: 'test-parent' });
                expect(window.isTermFilterValidated).toBe(true);
                expect(window.theme.terminal.colorFilter[0]).toEqual({ func: 'lighten', arg: [-0.5] });
            });

            it('accepts filter with zero arg', () => {
                window.theme.terminal.colorFilter = ['lighten(0)'];
                new Terminal({ id: 0, parentId: 'test-parent' });
                expect(window.isTermFilterValidated).toBe(true);
                expect(window.theme.terminal.colorFilter[0]).toEqual({ func: 'lighten', arg: [0] });
            });

            it('parses no-paren filter correctly (negate)', () => {
                window.theme.terminal.colorFilter = ['negate'];
                new Terminal({ id: 0, parentId: 'test-parent' });
                expect(window.isTermFilterValidated).toBe(true);
                expect(window.theme.terminal.colorFilter[0]).toEqual({ func: 'negate', arg: [] });
            });
        });

        describe('caching via window.isTermFilterValidated', () => {
            it('skips re-validation when isTermFilterValidated is already true', () => {
                window.theme.terminal.colorFilter = ['lighten(0.2)'];
                window.isTermFilterValidated = true;
                // Manually set the expected parsed form (simulating previous validation)
                window.theme.terminal.colorFilter[0] = { func: 'lighten', arg: [0.2] };

                const everySpy = vi.spyOn(window.theme.terminal.colorFilter, 'every');
                new Terminal({ id: 0, parentId: 'test-parent' });
                // every() should NOT be called — cached
                expect(everySpy).not.toHaveBeenCalled();
            });
        });

        describe('default fallback (no custom filter)', () => {
            it('uses grayscale+mix(0.3) when no colorFilter set', () => {
                // No colorFilter in theme
                const term = new Terminal({ id: 0, parentId: 'test-parent' });
                // Default colorify: Color(base).grayscale().mix(Color(target), 0.3).hex()
                // Verify via xterm theme — all colors should be '#888888' from mock
                const xtermOpts = XtermTerminal.mock.calls[0][0];
                expect(xtermOpts.theme.black).toBe('#888888');
                expect(xtermOpts.theme.red).toBe('#888888');
            });

            it('uses grayscale+mix(0.3) when colorFilter is empty array', () => {
                window.theme.terminal.colorFilter = [];
                new Terminal({ id: 0, parentId: 'test-parent' });
                const xtermOpts = XtermTerminal.mock.calls[0][0];
                expect(xtermOpts.theme.black).toBe('#888888');
            });

            it('uses grayscale+mix(0.3) when colorFilter validation fails', () => {
                window.theme.terminal.colorFilter = ['bogus(1)'];
                new Terminal({ id: 0, parentId: 'test-parent' });
                const xtermOpts = XtermTerminal.mock.calls[0][0];
                expect(xtermOpts.theme.black).toBe('#888888');
            });

            it('calls colorify 16 times for all terminal colors', async () => {
                const Color = (await import('color')).default;
                new Terminal({ id: 0, parentId: 'test-parent' });
                // 16 terminal colors: black, red, green, yellow, blue, magenta, cyan, white,
                // brightBlack, brightRed, brightGreen, brightYellow, brightBlue, brightMagenta,
                // brightCyan, brightWhite
                // Each calls Color() twice (base + target in .mix())
                expect(Color).toHaveBeenCalledTimes(32);
            });
        });
    });
});

describe('terminal.class.js source migration', () => {
    it('uses getSetting instead of direct window.settings access for migrated keys', () => {
        const src = readFileSync(resolve(__dirname, '../../../src/renderer/classes/terminal.class.js'), 'utf-8');
        expect(src).toContain('getSetting');
        expect(src).not.toMatch(/window\.settings\.termFontSize/);
        expect(src).not.toMatch(/window\.settings\.experimentalGlobeFeatures/);
        expect(src).not.toMatch(/window\.settings\.allowWindowed/);
    });
});
