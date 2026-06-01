/**
 * Settings schema — single source of truth for all settings definitions.
 * Used by renderer (settings editor) and main process (ipc-settings validation).
 */

export const SETTINGS_SCHEMA = [
    { key: 'shell', type: 'text', description: 'The program to run as a terminal emulator', defaultValue: '/bin/bash' },
    { key: 'shellArgs', type: 'text', description: 'Arguments to pass to the shell', defaultValue: '' },
    { key: 'cwd', type: 'text', description: 'Working Directory to start in', defaultValue: '' },
    { key: 'env', type: 'text', description: 'Custom shell environment override', defaultValue: '' },
    { key: 'username', type: 'text', description: 'Custom username to display at boot', defaultValue: '' },
    { key: 'keyboard', type: 'select', description: 'On-screen keyboard layout code', defaultValue: 'en_US', source: 'keyboards' },
    { key: 'theme', type: 'select', description: 'Name of the theme to load', defaultValue: 'tron', source: 'themes' },
    { key: 'termFontSize', type: 'number', description: 'Size of the terminal text in pixels', defaultValue: 15 },
    { key: 'audio', type: 'boolean', description: 'Activate audio sound effects', defaultValue: true, options: [true, false] },
    { key: 'audioVolume', type: 'number', description: 'Set default volume for sound effects (0.0 - 1.0)', defaultValue: 1.0 },
    { key: 'disableFeedbackAudio', type: 'boolean', description: 'Disable recurring feedback sound FX', defaultValue: false, options: [true, false] },
    { key: 'pingAddr', type: 'text', description: 'IPv4 address to test Internet connectivity', defaultValue: '1.1.1.1' },
    { key: 'clockHours', type: 'select', description: 'Clock format (12/24 hours)', defaultValue: 24, options: [12, 24] },
    { key: 'port', type: 'number', description: 'Local port to use for UI-shell connection', defaultValue: 3000 },
    { key: 'monitor', type: 'select', description: 'Which monitor to spawn the UI in', defaultValue: 0, source: 'displays' },
    { key: 'nointro', type: 'boolean', description: 'Skip the intro boot log and logo', defaultValue: false, options: [true, false] },
    { key: 'nocursor', type: 'boolean', description: 'Hide the mouse cursor', defaultValue: false, options: [true, false] },
    { key: 'allowWindowed', type: 'boolean', description: 'Allow using F11 key to set the UI in windowed mode', defaultValue: true, options: [true, false] },
    { key: 'keepGeometry', type: 'boolean', description: 'Try to keep a 16:9 aspect ratio in windowed mode', defaultValue: true, options: [true, false] },
    { key: 'hideDotfiles', type: 'boolean', description: 'Hide files and directories starting with a dot', defaultValue: true, options: [true, false] },
    { key: 'fsListView', type: 'boolean', description: 'Show files in a detailed list instead of icon grid', defaultValue: false, options: [true, false] },
    { key: 'forceFullscreen', type: 'boolean', description: 'Force fullscreen mode on startup', defaultValue: false, options: [true, false] },
    { key: 'excludeThreadsFromToplist', type: 'boolean', description: 'Exclude threads from the process toplist', defaultValue: false, options: [true, false] },
    { key: 'experimentalGlobeFeatures', type: 'boolean', description: 'Enable experimental globe features', defaultValue: false, options: [true, false] },
    { key: 'experimentalFeatures', type: 'boolean', description: 'Enable experimental features', defaultValue: false, options: [true, false] },
];

/**
 * @returns {string[]} All setting key names
 */
export function getSchemaKeys() {
    return SETTINGS_SCHEMA.map(e => e.key);
}

/**
 * @param {string} key
 * @returns {object|undefined} Schema entry for key
 */
export function getSchemaEntry(key) {
    return SETTINGS_SCHEMA.find(e => e.key === key);
}

/**
 * @returns {object} Default values for all settings
 */
export function getDefaults() {
    const defaults = {};
    for (const entry of SETTINGS_SCHEMA) {
        if (entry.defaultValue !== undefined) {
            defaults[entry.key] = entry.defaultValue;
        }
    }
    return defaults;
}
