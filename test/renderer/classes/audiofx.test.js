// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Mock howler before importing the module under test
// Use class so `new Howl(...)` works; track instances for assertions
const { mockHowlInstances, MockHowl, mockHowlerVolume } = vi.hoisted(() => {
    const mockHowlInstances = [];
    const MockHowl = vi.fn();
    const mockHowlerVolume = vi.fn();

    MockHowl.mockImplementation(function (opts) {
        this._src = opts && opts.src;
        this._volume = opts && opts.volume;
        this.play = vi.fn().mockReturnValue(1);
        mockHowlInstances.push(this);
    });

    return { mockHowlInstances, MockHowl, mockHowlerVolume };
});

vi.mock('howler', () => ({
    Howl: MockHowl,
    Howler: { volume: mockHowlerVolume },
}));

vi.mock('../../../src/renderer/state.js', () => ({
    getSetting: (key, defaultValue) => window.settings[key] ?? defaultValue,
}));

import { AudioManager, createAudioManager } from '../../../src/renderer/classes/audiofx.class.js';

describe('AudioManager', () => {
    const allSoundNames = [
        'stdout', 'stdin', 'folder', 'granted',
        'keyboard', 'theme', 'expand', 'panels',
        'scan', 'denied', 'info', 'alarm', 'error',
    ];

    function makeAudioPaths() {
        const paths = {};
        for (const name of allSoundNames) {
            paths[name] = `file:///audio/${name}.wav`;
        }
        return paths;
    }

    beforeEach(() => {
        mockHowlInstances.length = 0;
        MockHowl.mockClear();
        window.settings = {};
    });

    afterEach(() => {
        delete window.settings;
    });

    describe('constructor with audio enabled', () => {
        beforeEach(() => {
            window.settings = {
                audio: true,
                disableFeedbackAudio: false,
                audioVolume: 0.75,
            };
        });

        it('creates Howl instances for all 13 sounds when audio is enabled', () => {
            const paths = makeAudioPaths();
            new AudioManager(paths);

            // 13 sounds total
            expect(MockHowl).toHaveBeenCalledTimes(13);

            // Each Howl created with matching src
            for (const name of allSoundNames) {
                expect(MockHowl).toHaveBeenCalledWith(
                    expect.objectContaining({ src: [paths[name]] })
                );
            }
        });

        it('sets Howler global volume to settings.audioVolume', () => {
            new AudioManager(makeAudioPaths());

            expect(mockHowlerVolume).toHaveBeenCalledWith(0.75);
        });

        it('creates feedback sounds (stdout, stdin) with volume 0.4', () => {
            const paths = makeAudioPaths();
            new AudioManager(paths);

            const feedbackSounds = ['stdout', 'stdin'];
            for (const name of feedbackSounds) {
                expect(MockHowl).toHaveBeenCalledWith(
                    expect.objectContaining({ src: [paths[name]], volume: 0.4 })
                );
            }
        });

        it('has Howl instances as properties on the returned object', () => {
            const paths = makeAudioPaths();
            const manager = new AudioManager(paths);

            expect(manager.keyboard).toBeDefined();
            expect(manager.keyboard._src).toEqual([paths.keyboard]);
        });
    });

    describe('constructor with audio disabled', () => {
        beforeEach(() => {
            window.settings = {
                audio: false,
            };
        });

        it('sets Howler volume to 0 when audio is disabled', () => {
            new AudioManager(makeAudioPaths());

            expect(mockHowlerVolume).toHaveBeenCalledWith(0.0);
        });

        it('creates zero Howl instances when audio is disabled', () => {
            new AudioManager(makeAudioPaths());

            expect(MockHowl).not.toHaveBeenCalled();
        });
    });

    describe('constructor with disableFeedbackAudio', () => {
        beforeEach(() => {
            window.settings = {
                audio: true,
                disableFeedbackAudio: true,
                audioVolume: 1.0,
            };
        });

        it('skips stdout, stdin, folder, and granted sounds', () => {
            const paths = makeAudioPaths();
            const manager = new AudioManager(paths);

            // Only 9 sounds: keyboard, theme, expand, panels, scan, denied, info, alarm, error
            expect(MockHowl).toHaveBeenCalledTimes(9);

            // Feedback sounds should not exist as own properties
            expect(manager).not.toHaveProperty('stdout');
            expect(manager).not.toHaveProperty('stdin');
            expect(manager).not.toHaveProperty('folder');
            expect(manager).not.toHaveProperty('granted');
        });

        it('still creates non-feedback sounds', () => {
            const manager = new AudioManager(makeAudioPaths());

            expect(manager.keyboard).toBeDefined();
            expect(manager.theme).toBeDefined();
            expect(manager.expand).toBeDefined();
            expect(manager.panels).toBeDefined();
            expect(manager.scan).toBeDefined();
            expect(manager.denied).toBeDefined();
            expect(manager.info).toBeDefined();
            expect(manager.alarm).toBeDefined();
            expect(manager.error).toBeDefined();
        });
    });

    describe('Proxy fallback for missing sounds', () => {
        beforeEach(() => {
            window.settings = {
                audio: true,
                disableFeedbackAudio: true,
                audioVolume: 1.0,
            };
        });

        it('returns a proxy object that intercepts missing properties', () => {
            const manager = new AudioManager(makeAudioPaths());

            // stdout was skipped (disableFeedbackAudio), but proxy should intercept
            expect(manager.stdout).toBeDefined();
        });

        it('proxy returns object with play() that returns true for missing sounds', () => {
            const manager = new AudioManager(makeAudioPaths());

            expect(manager.stdout.play()).toBe(true);
            expect(manager.stdin.play()).toBe(true);
            expect(manager.folder.play()).toBe(true);
            expect(manager.granted.play()).toBe(true);
        });

        it('proxy returns play() for completely unknown property names', () => {
            const manager = new AudioManager(makeAudioPaths());

            expect(manager.totallyUnknownSound.play()).toBe(true);
        });

        it('proxy does not intercept properties that exist', () => {
            const paths = makeAudioPaths();
            const manager = new AudioManager(paths);

            // keyboard is a real Howl mock, not the proxy fallback
            expect(manager.keyboard._src).toEqual([paths.keyboard]);
        });
    });

    describe('dispose', () => {
        it('has a dispose method', () => {
            expect(typeof AudioManager.prototype.dispose).toBe('function');
        });
    });
});

describe('migration guard', () => {
    it('uses getSetting instead of direct window.settings access', () => {
        const src = readFileSync(resolve(__dirname, '../../../src/renderer/classes/audiofx.class.js'), 'utf-8');
        expect(src).toContain('getSetting');
        expect(src).not.toMatch(/window\.settings\.audio\b/);
        expect(src).not.toMatch(/window\.settings\.disableFeedbackAudio/);
        expect(src).not.toMatch(/window\.settings\.audioVolume/);
    });
});

describe('createAudioManager', () => {
    let mockGetAudioUrl;

    beforeEach(() => {
        mockHowlInstances.length = 0;
        MockHowl.mockClear();

        mockGetAudioUrl = vi.fn().mockImplementation((name) =>
            Promise.resolve(`file:///resolved/${name}`)
        );
        window.electronAPI = { getAudioUrl: mockGetAudioUrl };
        window.settings = {
            audio: true,
            disableFeedbackAudio: false,
            audioVolume: 0.5,
        };
    });

    afterEach(() => {
        delete window.electronAPI;
        delete window.settings;
    });

    it('calls electronAPI.getAudioUrl for each of the 13 sound names', async () => {
        await createAudioManager();

        expect(mockGetAudioUrl).toHaveBeenCalledTimes(13);

        const expectedNames = [
            'stdout.wav', 'stdin.wav', 'folder.wav', 'granted.wav',
            'keyboard.wav', 'theme.wav', 'expand.wav', 'panels.wav',
            'scan.wav', 'denied.wav', 'info.wav', 'alarm.wav', 'error.wav',
        ];
        for (const name of expectedNames) {
            expect(mockGetAudioUrl).toHaveBeenCalledWith(name);
        }
    });

    it('returns an AudioManager instance', async () => {
        const manager = await createAudioManager();

        expect(manager).toBeDefined();
        // AudioManager constructor returns a Proxy, but it should have Howl instances
        expect(manager.keyboard).toBeDefined();
    });

    it('passes resolved URLs to Howl constructors', async () => {
        await createAudioManager();

        expect(MockHowl).toHaveBeenCalledWith(
            expect.objectContaining({ src: ['file:///resolved/keyboard.wav'] })
        );
        expect(MockHowl).toHaveBeenCalledWith(
            expect.objectContaining({ src: ['file:///resolved/theme.wav'] })
        );
    });
});
