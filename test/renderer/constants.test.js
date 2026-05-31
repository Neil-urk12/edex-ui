// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { POLL_INTERVALS, THROTTLE, UI_TIMING, Z_INDEX, TERMINAL_DEFAULTS, AUDIO_DEFAULTS, RAM_POINT_COUNT } from '../../src/renderer/constants.js';

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
	'HARDWARE_INSPECTOR',
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


describe('UI_TIMING', () => {
	const expectedKeys = [
		'KEY_HOLD_INTERVAL',
		'KEY_HOLD_TIMEOUT',
		'KEY_BLINK_DURATION',
		'MODAL_DRAG_DELAY',
		'MODAL_CLOSE_ANIMATION',
	];

	it('has all expected keys', () => {
		expect(Object.keys(UI_TIMING).sort()).toEqual(expectedKeys.sort());
	});

	it('values are positive numbers', () => {
		for (const [key, value] of Object.entries(UI_TIMING)) {
			expect(typeof value).toBe('number');
			expect(value).toBeGreaterThan(0);
		}
	});

	it('values match known timings', () => {
		expect(UI_TIMING.KEY_HOLD_INTERVAL).toBe(70);
		expect(UI_TIMING.KEY_HOLD_TIMEOUT).toBe(400);
		expect(UI_TIMING.KEY_BLINK_DURATION).toBe(100);
		expect(UI_TIMING.MODAL_DRAG_DELAY).toBe(500);
		expect(UI_TIMING.MODAL_CLOSE_ANIMATION).toBe(100);
	});
});

describe('Z_INDEX', () => {
	const expectedKeys = ['ERROR_MODAL', 'WARNING_MODAL', 'INFO_MODAL'];

	it('has all expected keys', () => {
		expect(Object.keys(Z_INDEX).sort()).toEqual(expectedKeys.sort());
	});

	it('values are positive numbers', () => {
		for (const [key, value] of Object.entries(Z_INDEX)) {
			expect(typeof value).toBe('number');
			expect(value).toBeGreaterThan(0);
		}
	});

	it('values match known indices', () => {
		expect(Z_INDEX.ERROR_MODAL).toBe(1500);
		expect(Z_INDEX.WARNING_MODAL).toBe(1000);
		expect(Z_INDEX.INFO_MODAL).toBe(500);
	});

	it('ordering: error > warning > info', () => {
		expect(Z_INDEX.ERROR_MODAL).toBeGreaterThan(Z_INDEX.WARNING_MODAL);
		expect(Z_INDEX.WARNING_MODAL).toBeGreaterThan(Z_INDEX.INFO_MODAL);
	});
});

describe('TERMINAL_DEFAULTS', () => {
	const expectedKeys = ['FONT_SIZE', 'SCROLLBACK'];

	it('has all expected keys', () => {
		expect(Object.keys(TERMINAL_DEFAULTS).sort()).toEqual(expectedKeys.sort());
	});

	it('values are positive numbers', () => {
		for (const [key, value] of Object.entries(TERMINAL_DEFAULTS)) {
			expect(typeof value).toBe('number');
			expect(value).toBeGreaterThan(0);
		}
	});

	it('values match known defaults', () => {
		expect(TERMINAL_DEFAULTS.FONT_SIZE).toBe(15);
		expect(TERMINAL_DEFAULTS.SCROLLBACK).toBe(1500);
	});
});

describe('AUDIO_DEFAULTS', () => {
	const expectedKeys = ['VOLUME'];

	it('has all expected keys', () => {
		expect(Object.keys(AUDIO_DEFAULTS).sort()).toEqual(expectedKeys.sort());
	});

	it('volume is in valid range (0, 1]', () => {
		expect(AUDIO_DEFAULTS.VOLUME).toBeGreaterThan(0);
		expect(AUDIO_DEFAULTS.VOLUME).toBeLessThanOrEqual(1);
	});

	it('volume matches known default', () => {
		expect(AUDIO_DEFAULTS.VOLUME).toBe(0.4);
	});
});

describe('RAM_POINT_COUNT', () => {
	it('has the expected value', () => {
		expect(RAM_POINT_COUNT).toBe(440);
	});
});
