import { describe, it, expect, vi, beforeEach } from 'vitest';
import { register } from '../../src/main/ipc-settings.js';

const mockIpcMain = { handle: vi.fn() };
const mockWriteFileSync = vi.fn();
const mockReadJsonFile = vi.fn().mockReturnValue({});

const mockDefaultSettings = {
    shell: '/bin/bash',
    shellArgs: '',
    cwd: '/home/user',
    env: '',
    username: '',
    keyboard: 'en_US',
    theme: 'tron',
    termFontSize: 15,
    audio: true,
    audioVolume: 1.0,
    disableFeedbackAudio: false,
    pingAddr: '1.1.1.1',
    clockHours: 24,
    port: 3000,
    monitor: 0,
    nointro: false,
    nocursor: false,
    allowWindowed: true,
    keepGeometry: true,
    hideDotfiles: true,
    fsListView: false,
};

const deps = {
    settingsFile: '/tmp/test-settings.json',
    defaultSettings: mockDefaultSettings,
    userData: '/tmp/userData',
    writeFileSync: mockWriteFileSync,
};

function getHandler(channel) {
    const call = mockIpcMain.handle.mock.calls.find(([ch]) => ch === channel);
    if (!call) throw new Error(`No handler registered for channel: ${channel}`);
    return call[1];
}

beforeEach(() => {
    vi.clearAllMocks();
    mockReadJsonFile.mockReturnValue({});
    register(mockIpcMain, { ...deps, readJsonFile: mockReadJsonFile });
});

describe('saveSettings with schema validation', () => {
    it('accepts keys that exist in the schema', async () => {
        mockReadJsonFile.mockReturnValue({});
        const handler = getHandler('saveSettings');
        const result = await handler(null, {
            theme: 'cyber',
            termFontSize: 18,
            keyboard: 'fr_FR',
        });
        expect(result.theme).toBe('cyber');
        expect(result.termFontSize).toBe(18);
        expect(result.keyboard).toBe('fr_FR');
    });

    it('ignores unknown keys not in schema', async () => {
        mockReadJsonFile.mockReturnValue({});
        const handler = getHandler('saveSettings');
        const result = await handler(null, {
            theme: 'cyber',
            unknownKey: 'should be ignored',
            anotherUnknown: 42,
        });
        expect(result.theme).toBe('cyber');
        expect(result).not.toHaveProperty('unknownKey');
        expect(result).not.toHaveProperty('anotherUnknown');
    });

    it('preserves number types', async () => {
        mockReadJsonFile.mockReturnValue({});
        const handler = getHandler('saveSettings');
        const result = await handler(null, { termFontSize: 20, port: 4000 });
        expect(typeof result.termFontSize).toBe('number');
        expect(typeof result.port).toBe('number');
    });

    it('preserves boolean types', async () => {
        mockReadJsonFile.mockReturnValue({});
        const handler = getHandler('saveSettings');
        const result = await handler(null, { audio: false, nointro: true });
        expect(typeof result.audio).toBe('boolean');
        expect(typeof result.nointro).toBe('boolean');
    });

    it('preserves string types', async () => {
        mockReadJsonFile.mockReturnValue({});
        const handler = getHandler('saveSettings');
        const result = await handler(null, { theme: 'matrix', keyboard: 'de_DE' });
        expect(typeof result.theme).toBe('string');
        expect(typeof result.keyboard).toBe('string');
    });

    it('merges with defaults for keys not in partial', async () => {
        mockReadJsonFile.mockReturnValue({});
        const handler = getHandler('saveSettings');
        const result = await handler(null, { theme: 'cyber' });
        // Should have defaults for other keys
        expect(result).toHaveProperty('theme');
        expect(result).toHaveProperty('termFontSize');
        expect(result).toHaveProperty('audio');
    });

    it('writes to settings file', async () => {
        mockReadJsonFile.mockReturnValue({});
        const handler = getHandler('saveSettings');
        await handler(null, { theme: 'cyber' });
        expect(mockWriteFileSync).toHaveBeenCalledWith(
            deps.settingsFile,
            expect.any(String)
        );
    });

    it('blocks env key from being saved (security: prevent env injection)', async () => {
        mockReadJsonFile.mockReturnValue({});
        const handler = getHandler('saveSettings');
        const result = await handler(null, { env: 'MALICIOUS=value', theme: 'cyber' });
        expect(result.theme).toBe('cyber');
        // env should remain at default, not overwritten by user input
        expect(result.env).toBe('');
    });

    it('blocks username key from being saved (security: prevent spoofing)', async () => {
        mockReadJsonFile.mockReturnValue({});
        const handler = getHandler('saveSettings');
        const result = await handler(null, { username: 'spoofed', theme: 'cyber' });
        expect(result.theme).toBe('cyber');
        // username should remain at default, not overwritten by user input
        expect(result.username).toBe('');
    });

    it('blocks env/username even when sent with other valid keys', async () => {
        mockReadJsonFile.mockReturnValue({});
        const handler = getHandler('saveSettings');
        const result = await handler(null, {
            theme: 'matrix',
            env: 'LD_PRELOAD=/tmp/evil.so',
            username: 'root',
            termFontSize: 20,
        });
        expect(result.theme).toBe('matrix');
        expect(result.termFontSize).toBe(20);
        // security-sensitive keys should remain at defaults
        expect(result.env).toBe('');
        expect(result.username).toBe('');
    });
});
