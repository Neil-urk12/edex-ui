// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RAMwatcher } from '../../../src/renderer/classes/ramwatcher.class.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('RAMwatcher', () => {
    let parentElement;
    let mockElectronAPI;

    beforeEach(() => {
        vi.useFakeTimers();
        parentElement = document.createElement('div');
        parentElement.setAttribute('id', 'test-parent');
        document.body.appendChild(parentElement);

        mockElectronAPI = {
            getMemoryInfo: vi.fn().mockResolvedValue({
                total: 16000000000,
                active: 8000000000,
                available: 4000000000,
                free: 2000000000,
                swaptotal: 8000000000,
                swapused: 1000000000
            })
        };
        window.electronAPI = mockElectronAPI;
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
        delete window.electronAPI;
    });

    describe('constructor', () => {
        it('throws "Missing parameters" when parentId is missing', () => {
            expect(() => new RAMwatcher()).toThrow('Missing parameters');
        });

        it('creates DOM container with id "mod_ramwatcher"', () => {
            new RAMwatcher('test-parent');
            const container = document.getElementById('mod_ramwatcher');
            expect(container).toBeTruthy();
        });

        it('calls getMemoryInfo on init', async () => {
            new RAMwatcher('test-parent');
            await vi.advanceTimersByTimeAsync(0);
            expect(mockElectronAPI.getMemoryInfo).toHaveBeenCalled();
        });
    });

    describe('guard flag initialization', () => {
        it('initializes currentlyUpdating to false before guardedPoll sets it', async () => {
            // Spy on guardedPoll to prevent it from setting the flag,
            // so we can check the constructor's raw initialization
            const pollGuard = await import('../../../src/renderer/utils/poll-guard.js');
            const spy = vi.spyOn(pollGuard, 'guardedPoll').mockImplementation(
                (instance, flagName, apiCall, onSuccess) => {
                    // Do NOT set instance[flagName] — just run the callback
                    return apiCall().then(data => onSuccess(data)).catch(() => {});
                }
            );
            try {
                const rw = new RAMwatcher('test-parent');
                expect(rw.currentlyUpdating).toBe(false);
            } finally {
                spy.mockRestore();
            }
        });
    });

    describe('error handling', () => {
        it('does not leave currentlyUpdating stuck true when getMemoryInfo rejects', async () => {
            mockElectronAPI.getMemoryInfo.mockRejectedValue(new Error('IPC failed'));
            const rw = new RAMwatcher('test-parent');
            await vi.advanceTimersByTimeAsync(0); // let init reject
            expect(rw.currentlyUpdating).toBe(false);
        });

        it('continues polling after getMemoryInfo rejects', async () => {
            mockElectronAPI.getMemoryInfo
                .mockRejectedValueOnce(new Error('IPC failed'))
                .mockResolvedValueOnce({
                    total: 16000000000,
                    active: 8000000000,
                    available: 4000000000,
                    free: 2000000000,
                    swaptotal: 8000000000,
                    swapused: 1000000000
                });

            new RAMwatcher('test-parent');
            await vi.advanceTimersByTimeAsync(0); // let first call reject

            // Advance past the 1500ms polling interval
            vi.advanceTimersByTime(1500);
            await vi.advanceTimersByTimeAsync(0);

            expect(mockElectronAPI.getMemoryInfo).toHaveBeenCalledTimes(2);
        });
    });
});

describe('ramwatcher.class.js migration guard', () => {
    it('returns guardedPoll promise to prevent unhandled rejections', () => {
        const src = readFileSync(resolve(__dirname, '../../../src/renderer/classes/ramwatcher.class.js'), 'utf-8');
        const pollLines = src.split('\n').filter(l => l.includes('guardedPoll(') && !l.includes('import') && !l.trim().startsWith('//'));
        for (const line of pollLines) {
            expect(line.trim()).toMatch(/^return guardedPoll/);
        }
    });
});
