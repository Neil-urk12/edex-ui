// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Sysinfo } from '../../../src/renderer/classes/sysinfo.class.js';

describe('Sysinfo', () => {
    let parentElement;
    let mockElectronAPI;

    beforeEach(() => {
        vi.useFakeTimers();
        parentElement = document.createElement('div');
        parentElement.setAttribute('id', 'test-parent');
        document.body.appendChild(parentElement);

        mockElectronAPI = {
            getSystemUptime: vi.fn().mockResolvedValue(3600)
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
            expect(() => new Sysinfo()).toThrow('Missing parameters');
        });

        it('creates DOM container with id "mod_sysinfo"', () => {
            new Sysinfo('test-parent');
            const container = document.getElementById('mod_sysinfo');
            expect(container).toBeTruthy();
        });
    });

    describe('error handling', () => {
        it('does not throw when getSystemUptime rejects', async () => {
            mockElectronAPI.getSystemUptime.mockRejectedValue(new Error('IPC failed'));
            new Sysinfo('test-parent');

            // Trigger updateUptime via interval
            vi.advanceTimersByTime(60000);
            await vi.advanceTimersByTimeAsync(0);

            // Should not have thrown
            expect(true).toBe(true);
        });

        it('handles missing getSystemUptime gracefully using performance fallback', () => {
            delete mockElectronAPI.getSystemUptime;
            window.electronAPI = mockElectronAPI;

            new Sysinfo('test-parent');

            // updateUptime is called in constructor, should use performance.now() fallback
            const uptimeEl = document.querySelector('#mod_sysinfo > div:nth-child(2) > h2');
            expect(uptimeEl).toBeTruthy();
            expect(uptimeEl.innerHTML).toMatch(/\d+:\d+/);
        });
    });
});
