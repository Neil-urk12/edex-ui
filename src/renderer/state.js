/**
 * Centralized state accessor for renderer.
 * Reads from globalThis.settings (set at boot, updated on save).
 */

let _initSettingsWarned = false;
let _noSettingsWarned = false;

/**
 * Initialize settings state. Currently a no-op — settings live on globalThis.settings.
 * Retained for call-site compatibility.
 * @param {object} settings - Settings object from main process
 */
export function initSettings(settings) {
	if (!_initSettingsWarned) {
		console.warn('[state] initSettings is deprecated — settings live on globalThis.settings. This call is a no-op.');
		_initSettingsWarned = true;
	}
}

/**
 * Get the current settings object.
 * @returns {object} The live settings object
 */
export function getSettings() {
	return { ...(globalThis.settings || {}) };
}

/**
 * Get a single setting value.
 * @param {string} key - Setting key
 * @param {*} [defaultValue] - Default if key missing
 * @returns {*} Setting value
 */
export function getSetting(key, defaultValue) {
	const settings = globalThis.settings;
	if (!settings) {
		if (!_noSettingsWarned) {
			console.warn('[state] getSetting called before globalThis.settings is set');
			_noSettingsWarned = true;
		}
		return defaultValue;
	}
	return key in settings ? settings[key] : defaultValue;
}

/**
 * Set a single setting value.
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 */
export function setSetting(key, value) {
	if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
		console.warn('[state] setSetting: blocked dangerous key:', key);
		return;
	}
	if (!globalThis.settings) {
		globalThis.settings = {};
	}
	globalThis.settings[key] = value;
}
