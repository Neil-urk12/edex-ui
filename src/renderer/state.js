/**
 * Centralized state for renderer.
 * Replaces direct window.* global access with a testable module.
 */

let _settings = {};

/**
 * Initialize settings state. Call once at boot.
 * @param {object} settings - Settings object from main process
 */
export function initSettings(settings) {
	_settings = Object.freeze({ ...settings });
}

/**
 * Get the current settings object.
 * @returns {object} Frozen settings object
 */
export function getSettings() {
	return _settings;
}

/**
 * Get a single setting value.
 * @param {string} key - Setting key
 * @param {*} [defaultValue] - Default if key missing
 * @returns {*} Setting value
 */
export function getSetting(key, defaultValue) {
	return key in _settings ? _settings[key] : defaultValue;
}

/**
 * Reset state (for testing only).
 */
export function _resetState() {
	_settings = {};
}
