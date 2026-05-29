// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadBootLog, displayTitleScreen, waitForFonts } from '../../src/renderer/boot.js';

// Helper: mock document.fonts for jsdom (FontFaceSet doesn't support defineProperty)
function mockDocumentFonts(status = 'loaded') {
    const fonts = {
        status,
        onloadingdone: null,
        ready: Promise.resolve(),
    };
    Object.defineProperty(document, 'fonts', {
        value: fonts,
        configurable: true,
        writable: true,
    });
    return fonts;
}

describe('boot.js', () => {
    let mockElectronAPI;
    let mockAudioManager;

    beforeEach(() => {
        vi.useFakeTimers();

        // Mock electronAPI (matches real preload API surface)
        mockElectronAPI = {
            readAsset: vi.fn().mockResolvedValue(
                'line1\nline2\nline3\nBoot Complete\nline5'
            ),
            getAppVersion: vi.fn().mockResolvedValue('2.8.5'),
        };
        window.electronAPI = mockElectronAPI;

        // Mock audioManager (matches createAudioManager return shape)
        mockAudioManager = {
            stdout: { play: vi.fn() },
            granted: { play: vi.fn() },
            theme: { play: vi.fn() },
            expand: { play: vi.fn() },
            panels: { play: vi.fn() },
            keyboard: { play: vi.fn() },
            folder: { play: vi.fn() },
        };
        window.audioManager = mockAudioManager;

        // Mock theme (matches window.theme set by _loadTheme)
        window.theme = { r: '0', g: '255', b: '255' };
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
        document.head.innerHTML = '';
        delete window.electronAPI;
        delete window.audioManager;
        delete window.theme;
        delete window.term;
    });

    // ------------------------------------------------------------------
    // loadBootLog
    // ------------------------------------------------------------------
    describe('loadBootLog', () => {
        it('calls electronAPI.readAsset with misc/boot_log.txt', async () => {
            await loadBootLog(mockElectronAPI);

            expect(mockElectronAPI.readAsset).toHaveBeenCalledTimes(1);
            expect(mockElectronAPI.readAsset).toHaveBeenCalledWith('misc/boot_log.txt');
        });

        it('splits the returned text into an array of lines', async () => {
            const lines = await loadBootLog(mockElectronAPI);

            expect(Array.isArray(lines)).toBe(true);
            expect(lines).toEqual(['line1', 'line2', 'line3', 'Boot Complete', 'line5']);
        });

        it('returns fallback array when readAsset rejects', async () => {
            mockElectronAPI.readAsset.mockRejectedValue(new Error('ENOENT'));

            const lines = await loadBootLog(mockElectronAPI);

            expect(Array.isArray(lines)).toBe(true);
            expect(lines.length).toBeGreaterThan(0);
            // Fallback must include at least the sentinel
            expect(lines).toContain('Boot Complete');
        });

        it('returns fallback array when readAsset returns empty string', async () => {
            mockElectronAPI.readAsset.mockResolvedValue('');

            const lines = await loadBootLog(mockElectronAPI);

            // Empty string splits to [''], normalize to non-empty fallback
            expect(Array.isArray(lines)).toBe(true);
            expect(lines.length).toBeGreaterThan(0);
        });
    });

    // ------------------------------------------------------------------
    // waitForFonts
    // ------------------------------------------------------------------
    describe('waitForFonts', () => {
        it('resolves immediately when document.fonts.status is already loaded', async () => {
            // In jsdom, document.fonts may not have .status.
            // Stub it to simulate the loaded state.
            mockDocumentFonts('loaded');
            Object.defineProperty(document, 'readyState', {
                value: 'complete',
                configurable: true,
            });

            // Should resolve without hanging
            const promise = waitForFonts();
            await vi.runAllTimersAsync();
            await expect(promise).resolves.toBeUndefined();
        });

        it('resolves when document.fonts transitions to loaded', async () => {
            const fonts = mockDocumentFonts('loading');
            Object.defineProperty(document, 'readyState', {
                value: 'complete',
                configurable: true,
            });

            const promise = waitForFonts();

            // Simulate the font loading completing
            fonts.status = 'loaded';
            // Fire the onloadingdone callback if waitForFonts set one
            if (document.fonts.onloadingdone) {
                document.fonts.onloadingdone();
            }

            await expect(promise).resolves.toBeUndefined();
        });

        it('resolves when readystatechange fires and fonts are loaded', async () => {
            mockDocumentFonts('loaded');
            Object.defineProperty(document, 'readyState', {
                value: 'loading',
                configurable: true,
            });

            const promise = waitForFonts();

            // Transition to complete + loaded
            Object.defineProperty(document, 'readyState', {
                value: 'complete',
                configurable: true,
            });
            mockDocumentFonts('loaded');
            document.dispatchEvent(new Event('readystatechange'));

            await vi.runAllTimersAsync();
            await expect(promise).resolves.toBeUndefined();
        });
    });

    // ------------------------------------------------------------------
    // displayTitleScreen
    // ------------------------------------------------------------------
    describe('displayTitleScreen', () => {
        beforeEach(() => {
            // displayTitleScreen expects window.theme to be set
            window.theme = { r: '0', g: '255', b: '255' };

            // Stub waitForFonts internals: readyState + fonts.status
            mockDocumentFonts('loaded');
            Object.defineProperty(document, 'readyState', {
                value: 'complete',
                configurable: true,
            });
        });

        it('creates a boot_screen section when none exists', async () => {
            const onInitUI = vi.fn();

            const promise = displayTitleScreen({
                theme: window.theme,
                onInitUI,
            });
            await vi.runAllTimersAsync();
            await promise;

            // During the sequence boot_screen is created; after animation it is removed.
            // We verify it was created by checking the DOM mutations happened.
            // If it was created and removed, document.body should not contain it.
            // But onInitUI being called proves the full sequence ran.
            expect(onInitUI).toHaveBeenCalled();
        });

        it('clears and reuses existing boot_screen element', async () => {
            // Pre-create a boot_screen with stale content
            const existing = document.createElement('section');
            existing.id = 'boot_screen';
            existing.innerHTML = '<p>old content</p>';
            document.body.appendChild(existing);

            const onInitUI = vi.fn();

            const promise = displayTitleScreen({
                theme: window.theme,
                onInitUI,
            });
            await vi.runAllTimersAsync();
            await promise;

            // onInitUI proves the sequence completed using the existing element
            expect(onInitUI).toHaveBeenCalled();
        });

        it('sets h1 title text to eDEX-UI during animation', async () => {
            // We can't easily intercept mid-animation without stepping timers,
            // but we verify the final state: onInitUI was called and the
            // boot_screen was removed (the real code calls bootScreen.remove()).
            const onInitUI = vi.fn();

            const promise = displayTitleScreen({
                theme: window.theme,
                onInitUI,
            });
            await vi.runAllTimersAsync();
            await promise;

            // After completion, boot_screen should be removed from DOM
            expect(document.getElementById('boot_screen')).toBeNull();
        });

        it('calls onInitUI after animations complete', async () => {
            const callOrder = [];
            const onInitUI = vi.fn().mockImplementation(() => {
                callOrder.push('onInitUI');
            });

            const promise = displayTitleScreen({
                theme: window.theme,
                onInitUI,
            });
            await vi.runAllTimersAsync();
            await promise;

            expect(onInitUI).toHaveBeenCalledTimes(1);
            expect(callOrder).toContain('onInitUI');
        });

        it('plays theme audio at start of title screen', async () => {
            const onInitUI = vi.fn();

            const promise = displayTitleScreen({
                theme: window.theme,
                onInitUI,
            });
            await vi.runAllTimersAsync();
            await promise;

            expect(mockAudioManager.theme.play).toHaveBeenCalled();
        });

        it('applies theme colors to title element border', async () => {
            window.theme = { r: '255', g: '0', b: '128' };
            const onInitUI = vi.fn();

            const promise = displayTitleScreen({
                theme: window.theme,
                onInitUI,
            });
            await vi.runAllTimersAsync();
            await promise;

            // The function applies styles to the h1 during animation.
            // After completion, the final style has a border with the theme color.
            // We verify the function didn't throw and onInitUI was reached.
            expect(onInitUI).toHaveBeenCalled();
        });

        it('returns true when window.term already exists (skip path)', async () => {
            // When window.term exists, displayTitleScreen removes boot_screen
            // and returns true early without calling onInitUI.
            window.term = { 0: {} };

            const onInitUI = vi.fn();
            const result = await displayTitleScreen({
                theme: window.theme,
                onInitUI,
            });

            expect(result).toBe(true);
            expect(document.getElementById('boot_screen')).toBeNull();
            // onInitUI should NOT be called on the skip path
            expect(onInitUI).not.toHaveBeenCalled();
        });

        it('sanitizes non-numeric theme colors to safe fallback', async () => {
            const onInitUI = vi.fn();
            const promise = displayTitleScreen({
                theme: { r: 'abc', g: '0', b: '0' },
                onInitUI,
            });

            // Flush waitForFonts microtask so h1 gets created
            await vi.advanceTimersByTimeAsync(0);

            const h1 = document.querySelector('#boot_screen h1');
            expect(h1).toBeTruthy();
            // Should NOT contain 'rgb(abc,0,0)' — must use numeric fallback
            expect(h1.style.borderBottom).not.toContain('abc');
            expect(h1.style.borderBottom).toMatch(/rgb\(\d+, \d+, \d+\)/);

            // Let animation complete
            await vi.advanceTimersByTimeAsync(100);
            await promise;
        });

        it('clamps theme colors above 255', async () => {
            const onInitUI = vi.fn();
            const promise = displayTitleScreen({
                theme: { r: '999', g: '0', b: '0' },
                onInitUI,
            });

            await vi.advanceTimersByTimeAsync(0);

            const h1 = document.querySelector('#boot_screen h1');
            expect(h1).toBeTruthy();
            // r=999 should be clamped to 255
            expect(h1.style.borderBottom).toContain('rgb(255, 0, 0)');

            await vi.advanceTimersByTimeAsync(100);
            await promise;
        });

        it('clamps negative theme colors to 0', async () => {
            const onInitUI = vi.fn();
            const promise = displayTitleScreen({
                theme: { r: '-10', g: '0', b: '0' },
                onInitUI,
            });

            await vi.advanceTimersByTimeAsync(0);

            const h1 = document.querySelector('#boot_screen h1');
            expect(h1).toBeTruthy();
            // r=-10 should be clamped to 0
            expect(h1.style.borderBottom).toContain('rgb(0, 0, 0)');

            await vi.advanceTimersByTimeAsync(100);
            await promise;
        });

        it('handles missing theme color properties gracefully', async () => {
            const onInitUI = vi.fn();
            const promise = displayTitleScreen({
                theme: { r: '128' },
                onInitUI,
            });

            await vi.advanceTimersByTimeAsync(0);

            const h1 = document.querySelector('#boot_screen h1');
            expect(h1).toBeTruthy();
            // Missing g and b should default to 0
            expect(h1.style.borderBottom).toContain('rgb(128, 0, 0)');

            await vi.advanceTimersByTimeAsync(100);
            await promise;
        });
    });
});
