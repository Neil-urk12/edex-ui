import { describe, it, expect, beforeEach } from 'vitest';
import { initSettings, getSettings, getSetting, _resetState } from '../../src/renderer/state.js';

describe('state module', () => {
	beforeEach(() => {
		_resetState();
	});

	describe('initSettings', () => {
		it('stores settings object', () => {
			initSettings({ theme: 'dark', audio: true });
			expect(getSettings()).toEqual({ theme: 'dark', audio: true });
		});

		it('freezes settings (immutable)', () => {
			initSettings({ theme: 'dark' });
			const settings = getSettings();
			expect(Object.isFrozen(settings)).toBe(true);
		});

		it('overwrites previous settings', () => {
			initSettings({ theme: 'dark' });
			initSettings({ theme: 'light' });
			expect(getSettings().theme).toBe('light');
		});
	});

	describe('getSettings', () => {
		it('returns empty object before init', () => {
			expect(getSettings()).toEqual({});
		});

		it('returns frozen copy', () => {
			initSettings({ a: 1 });
			const s = getSettings();
			expect(Object.isFrozen(s)).toBe(true);
		});
	});

	describe('getSetting', () => {
		it('returns value for existing key', () => {
			initSettings({ theme: 'cyber', audio: false });
			expect(getSetting('theme')).toBe('cyber');
			expect(getSetting('audio')).toBe(false);
		});

		it('returns undefined for missing key', () => {
			initSettings({ theme: 'cyber' });
			expect(getSetting('nonexistent')).toBeUndefined();
		});

		it('returns default for missing key', () => {
			initSettings({ theme: 'cyber' });
			expect(getSetting('nonexistent', 'fallback')).toBe('fallback');
		});

		it('returns value even when default provided', () => {
			initSettings({ theme: 'cyber' });
			expect(getSetting('theme', 'default')).toBe('cyber');
		});
	});

	describe('_resetState', () => {
		it('clears settings', () => {
			initSettings({ theme: 'dark' });
			_resetState();
			expect(getSettings()).toEqual({});
		});
	});
});
