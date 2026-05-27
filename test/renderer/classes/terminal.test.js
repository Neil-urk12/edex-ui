// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

vi.mock('color', () => {
    const chainable = () => {
        const c = {
            grayscale: vi.fn().mockReturnThis(),
            mix: vi.fn().mockReturnThis(),
            hex: vi.fn().mockReturnValue('#888888'),
        };
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
    });
});
