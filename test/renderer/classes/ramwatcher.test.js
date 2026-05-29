// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RAMwatcher } from '../../../src/renderer/classes/ramwatcher.class.js';

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
