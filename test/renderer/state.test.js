import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initSettings, getSettings, getSetting, setSetting } from '../../src/renderer/state.js';

describe('state module', () => {
	describe('initSettings', () => {
		it('logs a deprecation warning only once', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			initSettings({ theme: 'dark' });
			initSettings({ theme: 'dark' });
			expect(warnSpy).toHaveBeenCalledTimes(1);
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('deprecated')
			);
			warnSpy.mockRestore();
		});

		it('is a no-op (retained for call-site compatibility)', () => {
			initSettings({ theme: 'dark', audio: true });
			expect(globalThis.settings).toBeUndefined();
		});
	});

	describe('getSettings', () => {
		it('returns empty object when globalThis.settings is undefined', () => {
			expect(getSettings()).toEqual({});
		});

		it('returns values from globalThis.settings', () => {
			globalThis.settings = { theme: 'cyber', audio: false };
			const s = getSettings();
			expect(s.theme).toBe('cyber');
			expect(s.audio).toBe(false);
		});

		it('reflects live changes to globalThis.settings', () => {
			globalThis.settings = { theme: 'dark' };
			expect(getSettings().theme).toBe('dark');
			globalThis.settings = { theme: 'light' };
			expect(getSettings().theme).toBe('light');
		});

		it('returns a copy, not the live reference', () => {
			globalThis.settings = { theme: 'cyber' };
			expect(getSettings()).not.toBe(globalThis.settings);
		});

		it('mutations to returned object do not affect globalThis.settings', () => {
			globalThis.settings = { theme: 'dark' };
			const s = getSettings();
			s.theme = 'mutated';
			expect(globalThis.settings.theme).toBe('dark');
		});
	});

	describe('getSetting', () => {
		it('returns value for existing key', () => {
			globalThis.settings = { theme: 'cyber', audio: false };
			expect(getSetting('theme')).toBe('cyber');
			expect(getSetting('audio')).toBe(false);
		});

		it('returns undefined for missing key', () => {
			globalThis.settings = { theme: 'cyber' };
			expect(getSetting('nonexistent')).toBeUndefined();
		});

		it('returns default for missing key', () => {
			globalThis.settings = { theme: 'cyber' };
			expect(getSetting('nonexistent', 'fallback')).toBe('fallback');
		});

		it('returns value even when default provided', () => {
			globalThis.settings = { theme: 'cyber' };
			expect(getSetting('theme', 'default')).toBe('cyber');
		});

		it('returns empty object default when globalThis.settings undefined', () => {
			expect(getSetting('anything', 'fallback')).toBe('fallback');
		});
	});

	describe('getSetting boot-order warning', () => {
		let getSetting;
		beforeEach(async () => {
			vi.resetModules();
			globalThis.settings = undefined;
			({ getSetting } = await import('../../src/renderer/state.js'));
		});

		it('warns when getSetting called before globalThis.settings is set', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			getSetting('theme', 'dark');
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('called before globalThis.settings')
			);
			warnSpy.mockRestore();
		});

		it('warns only once when globalThis.settings is missing', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			getSetting('a', 'default');
			getSetting('b', 'default');
			expect(warnSpy).toHaveBeenCalledTimes(1);
			warnSpy.mockRestore();
		});
	});

	describe('setSetting', () => {
		it('sets a value on globalThis.settings', () => {
			globalThis.settings = { theme: 'dark' };
			setSetting('theme', 'light');
			expect(globalThis.settings.theme).toBe('light');
		});

		it('creates key if it does not exist', () => {
			globalThis.settings = {};
			setSetting('newKey', 'value');
			expect(globalThis.settings.newKey).toBe('value');
		});

		it('initializes globalThis.settings if undefined', () => {
			globalThis.settings = undefined;
			setSetting('theme', 'dark');
			expect(globalThis.settings.theme).toBe('dark');
		});

		it('value is readable via getSetting', () => {
			globalThis.settings = {};
			setSetting('audio', true);
			expect(getSetting('audio')).toBe(true);
		});

		it('rejects __proto__ key', () => {
			globalThis.settings = {};
			setSetting('__proto__', { polluted: true });
			expect(globalThis.settings.__proto__).not.toEqual({ polluted: true });
		});

		it('rejects constructor key', () => {
			globalThis.settings = {};
			const original = globalThis.settings.constructor;
			setSetting('constructor', 'bad');
			expect(globalThis.settings.constructor).toBe(original);
		});

		it('rejects prototype key', () => {
			globalThis.settings = {};
			setSetting('prototype', 'bad');
			expect(globalThis.settings.prototype).toBeUndefined();
		});

		it('warns when setSetting blocks a dangerous key', () => {
			globalThis.settings = {};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			setSetting('__proto__', { bad: true });
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('blocked dangerous key'),
				'__proto__'
			);
			warnSpy.mockRestore();
		});
	});
});
