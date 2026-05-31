// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { POLL_INTERVALS, THROTTLE } from '../../src/renderer/constants.js';

describe('POLL_INTERVALS', () => {
    const expectedKeys = [
        'CPU_LOAD',
        'CPU_TEMP',
        'CPU_SPEED',
        'CPU_TASKS',
        'FILESYSTEM',
        'FILESYSTEM_RETRY',
        'RAM',
        'UPTIME',
        'BATTERY',
    ];

    it('has all expected keys', () => {
        expect(Object.keys(POLL_INTERVALS).sort()).toEqual(expectedKeys.sort());
    });

    it('values are positive numbers', () => {
        for (const [key, value] of Object.entries(POLL_INTERVALS)) {
            expect(typeof value).toBe('number');
            expect(value).toBeGreaterThan(0);
        }
    });

    it('values match known intervals', () => {
        expect(POLL_INTERVALS.CPU_LOAD).toBe(500);
        expect(POLL_INTERVALS.CPU_TEMP).toBe(2000);
        expect(POLL_INTERVALS.CPU_SPEED).toBe(1000);
        expect(POLL_INTERVALS.CPU_TASKS).toBe(5000);
        expect(POLL_INTERVALS.FILESYSTEM).toBe(1000);
        expect(POLL_INTERVALS.FILESYSTEM_RETRY).toBe(1000);
        expect(POLL_INTERVALS.RAM).toBe(1500);
        expect(POLL_INTERVALS.UPTIME).toBe(60000);
        expect(POLL_INTERVALS.BATTERY).toBe(3000);
    });
});

describe('THROTTLE', () => {
    const expectedKeys = ['SOUND_FX', 'TERMINAL_REFIT'];

    it('has all expected keys', () => {
        expect(Object.keys(THROTTLE).sort()).toEqual(expectedKeys.sort());
    });

    it('values are positive numbers', () => {
        for (const [key, value] of Object.entries(THROTTLE)) {
            expect(typeof value).toBe('number');
            expect(value).toBeGreaterThan(0);
        }
    });

    it('values match known thresholds', () => {
        expect(THROTTLE.SOUND_FX).toBe(30);
        expect(THROTTLE.TERMINAL_REFIT).toBe(10000);
    });
});
