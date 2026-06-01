/**
 * Settings editor — schema-driven form generation and value collection.
 */
import { escapeHtml } from './utils.js';

/**
 * Render settings editor HTML table from schema.
 * @param {object[]} schema - Settings schema entries
 * @param {object} settings - Current settings values
 * @param {object} [options] - Dynamic option lists { themes, keyboards, displays }
 * @returns {string} HTML string
 */
export function renderSettingsEditor(schema, settings, options = {}) {
    let rows = `<tr>
        <th>Key</th>
        <th>Description</th>
        <th>Value</th>
    </tr>`;

    for (const entry of schema) {
        const value = settings[entry.key];
        let input;

        switch (entry.type) {
            case 'text':
                input = `<input type="text" id="settingsEditor-${entry.key}" value="${escapeHtml(String(value || ''))}">`;
                break;

            case 'number':
                input = `<input type="number" id="settingsEditor-${entry.key}" value="${escapeHtml(String(value))}">`;
                break;

            case 'boolean': {
                const boolVal = (value === undefined) ? entry.defaultValue : value;
                const current = String(boolVal);
                const other = String(!boolVal);
                input = `<select id="settingsEditor-${entry.key}">
                    <option>${escapeHtml(current)}</option>
                    <option>${escapeHtml(other)}</option>
                </select>`;
                break;
            }

            case 'select': {
                const sourceKey = entry.source;
                const dynamicOptions = sourceKey ? (options[sourceKey] || []) : [];
                const staticOptions = entry.options || [];

                let otherValues;
                if (sourceKey === 'displays') {
                    otherValues = dynamicOptions.filter(d => d !== value);
                } else if (sourceKey) {
                    otherValues = dynamicOptions.filter(o => o !== value);
                } else {
                    otherValues = staticOptions.filter(o => o !== value);
                }

                let optsHtml = `<option>${escapeHtml(String(value))}</option>`;
                for (const v of otherValues) {
                    optsHtml += `\n<option>${escapeHtml(String(v))}</option>`;
                }
                input = `<select id="settingsEditor-${entry.key}">${optsHtml}</select>`;
                break;
            }
            default:
                console.warn(`Unknown setting type: ${entry.type} for key ${entry.key}`);
                continue;
        }

        const OVERRIDE_FLAGS = { nointro: 'nointroOverride', nocursor: 'nocursorOverride' };
        const overrideNote = OVERRIDE_FLAGS[entry.key] && settings[OVERRIDE_FLAGS[entry.key]]
            ? ' (Currently overridden by CLI flag)'
            : '';

        rows += `<tr>
            <td>${entry.key}</td>
            <td>${entry.description}${overrideNote}</td>
            <td>${input}</td>
        </tr>`;
    }

    return `<table id="settingsEditor">${rows}</table>
<h6 id="settingsEditorStatus">Loaded values from memory</h6>
<br>`;
}

/**
 * Collect settings values from DOM inputs based on schema.
 * @param {object[]} schema - Settings schema entries
 * @returns {object} Collected settings
 */
export function collectSettingsFromDOM(schema) {
    const settings = {};

    for (const entry of schema) {
        const el = document.getElementById(`settingsEditor-${entry.key}`);
        if (!el) continue;

        const raw = el.value;

        switch (entry.type) {
            case 'text':
                settings[entry.key] = raw;
                break;
            case 'number':
                settings[entry.key] = Number(raw);
                break;
            case 'boolean':
                settings[entry.key] = raw === 'true';
                break;
            case 'select':
                settings[entry.key] = typeof entry.defaultValue === 'number' ? Number(raw) : raw;
                break;
            default:
                console.warn(`Unknown setting type: ${entry.type} for key ${entry.key}`);
                break;
        }
    }

    return settings;
}
