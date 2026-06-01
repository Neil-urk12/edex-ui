/**
 * Shortcuts editor — generates shortcuts help modal HTML.
 */
import { escapeHtml } from './utils.js';

const SHORTCUT_DEFINITIONS = {
    'COPY': 'Copy selected buffer from the terminal.',
    'PASTE': 'Paste system clipboard to the terminal.',
    'NEXT_TAB': 'Switch to the next opened terminal tab.',
    'PREVIOUS_TAB': 'Switch to the previous opened terminal tab.',
    'TAB_X': 'Switch to terminal tab <strong>X</strong>, or create it.',
    'SETTINGS': 'Open the settings editor.',
    'SHORTCUTS': 'List and edit available keyboard shortcuts.',
    'FUZZY_SEARCH': 'Search for entries in the current working directory.',
    'FS_LIST_VIEW': 'Toggle between list and grid view in the file browser.',
    'FS_DOTFILES': 'Toggle hidden files and directories.',
    'KB_PASSMODE': 'Toggle password mode on the on-screen keyboard.',
    'DEV_DEBUG': 'Open Chromium Dev Tools.',
    'DEV_RELOAD': 'Trigger front-end hot reload.',
};

/**
 * Render shortcuts help modal content.
 * @param {object[]} shortcuts - Array of shortcut definitions
 * @param {string} version - App version string
 * @returns {{ html: string }}
 */
export function renderShortcutsHelp(shortcuts, version) {
    let appList = '';
    shortcuts.filter(e => e.type === 'app').forEach(cut => {
        const action = cut.action.startsWith('TAB_') ? 'TAB_X' : cut.action;
        appList += `<tr>
            <td>${cut.enabled ? 'YES' : 'NO'}</td>
            <td><input disabled type="text" maxlength=25 value="${escapeHtml(cut.trigger)}"></td>
            <td>${SHORTCUT_DEFINITIONS[action] || escapeHtml(action)}</td>
        </tr>`;
    });

    let customList = '';
    shortcuts.filter(e => e.type === 'shell').forEach(cut => {
        customList += `<tr>
            <td>${cut.enabled ? 'YES' : 'NO'}</td>
            <td><input disabled type="text" maxlength=25 value="${escapeHtml(cut.trigger)}"></td>
            <td>
                <input disabled type="text" placeholder="Run terminal command..." value="${escapeHtml(cut.action)}">
                <input disabled type="checkbox" name="shortcutsHelpNew_Enter" ${cut.linebreak ? 'checked' : ''}>
                <label for="shortcutsHelpNew_Enter">Enter</label>
            </td>
        </tr>`;
    });

    const html = `<h5>Using either the on-screen or a physical keyboard, you can use the following shortcuts:</h5>
        <h3>Available Keyboard Shortcuts <i>(v${escapeHtml(version)})</i></h3>
        <details open id="shortcutsHelpAccordeon1">
            <summary>Emulator shortcuts</summary>
            <table class="shortcutsHelp">
                <tr>
                    <th>Enabled</th>
                    <th>Trigger</th>
                    <th>Action</th>
                </tr>
                ${appList}
            </table>
        </details>
        <br>
        <details id="shortcutsHelpAccordeon2">
            <summary>Custom command shortcuts</summary>
            <table class="shortcutsHelp">
                <tr>
                    <th>Enabled</th>
                    <th>Trigger</th>
                    <th>Command</th>
                </tr>
                ${customList}
            </table>
        </details>
        <br>`;

    return { html };
}
