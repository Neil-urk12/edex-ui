// eDEX-UI Renderer Entry Point (Electron 33+, contextIsolation, no Node.js in renderer)
import { escapeHtml, purifyCSS, delay, clampColor } from './utils.js';
import { createAudioManager } from './classes/audiofx.class.js';
import { createKeyboard } from './classes/keyboard.class.js';
import { Modal } from './classes/modal.class.js';
import { Clock } from './classes/clock.class.js';
import { Sysinfo } from './classes/sysinfo.class.js';
import { HardwareInspector } from './classes/hardwareInspector.class.js';
import { Cpuinfo } from './classes/cpuinfo.class.js';
import { RAMwatcher } from './classes/ramwatcher.class.js';
import { Terminal } from './classes/terminal.class.js';
import { FilesystemDisplay } from './classes/filesystem.class.js';
import { initSettings } from './state.js';

// CSS imports (Vite injects as <style> tags)
import '../assets/css/augmented.css';
import '../assets/css/main.css';
import '../assets/css/modal.css';
import '../assets/css/boot_screen.css';
import '../assets/css/media_player.css';
import '../assets/css/main_shell.css';
import '../assets/css/filesystem.css';
import '../assets/css/keyboard.css';
import '../assets/css/mod_column.css';
import '../assets/css/mod_clock.css';
import '../assets/css/mod_sysinfo.css';
import '../assets/css/mod_hardwareInspector.css';
import '../assets/css/mod_cpuinfo.css';
import '../assets/css/mod_netstat.css';
import '../assets/css/mod_conninfo.css';
import '../assets/css/mod_globe.css';
import '../assets/css/mod_ramwatcher.css';
import '../assets/css/mod_toplist.css';
import '../assets/css/mod_fuzzyFinder.css';
import '../assets/css/mod_processlist.css';
import '../assets/css/extra_ratios.css';

// ============================================================
// Initiate basic error handling
// ============================================================
window.onerror = (msg, path, line, col, error) => {
    console.error('[BOOT ERROR]', msg, path, line, col, error);
    try {
        const el = document.getElementById("boot_screen");
        if (el) el.innerHTML += `${escapeHtml(error)} : ${escapeHtml(msg)}<br/>==> at ${escapeHtml(path)} ${line}:${col}`;
    } catch {}
};

// ============================================================
// Load config
// ============================================================
window.settings = await window.electronAPI.getSettings();
window.shortcuts = window.settings.shortcuts || [];

// Retrieve theme override (hotswitch)
const themeOverride = await window.electronAPI.getThemeOverride();
if (themeOverride !== null) {
    window.settings.theme = themeOverride;
    window.settings.nointroOverride = true;
}

// Retrieve keyboard override (hotswitch)
const kbOverride = await window.electronAPI.getKbOverride();
if (kbOverride !== null) {
    window.settings.keyboard = kbOverride;
    window.settings.nointroOverride = true;
}

// Initialize centralized state module (non-breaking: window.settings still exists)
initSettings(window.settings);

// ============================================================
// Load UI theme
// ============================================================

window._loadTheme = async (theme) => {
    if (document.querySelector("style.theming")) {
        document.querySelector("style.theming").remove();
    }

    // Load fonts via IPC (main process reads file, returns base64)
    const fontsDir = await window.electronAPI.getAppPath('userData') + '/fonts';
    const mainFontName = theme.cssvars.font_main.toLowerCase().replace(/ /g, '_');
    const lightFontName = theme.cssvars.font_main_light.toLowerCase().replace(/ /g, '_');
    const termFontName = theme.terminal.fontFamily.toLowerCase().replace(/ /g, '_');

    const loadFont = async (family, path) => {
        try {
            const b64 = await window.electronAPI.readFileBinary(path);
            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: 'font/woff2' });
            const url = URL.createObjectURL(blob);
            const font = new FontFace(family, `url("${url}")`);
            document.fonts.add(font);
            await font.load();
        } catch (e) { console.warn('Font load failed:', family, e); }
    };

    await Promise.all([
        loadFont(theme.cssvars.font_main, `${fontsDir}/${mainFontName}.woff2`),
        loadFont(theme.cssvars.font_main_light, `${fontsDir}/${lightFontName}.woff2`),
        loadFont(theme.terminal.fontFamily, `${fontsDir}/${termFontName}.woff2`)
    ]);

    document.querySelector("head").innerHTML += `<style class="theming">
    :root {
        --font_main: "${purifyCSS(theme.cssvars.font_main)}";
        --font_main_light: "${purifyCSS(theme.cssvars.font_main_light)}";
        --font_mono: "${purifyCSS(theme.terminal.fontFamily)}";
        --color_r: ${purifyCSS(theme.colors.r)};
        --color_g: ${purifyCSS(theme.colors.g)};
        --color_b: ${purifyCSS(theme.colors.b)};
        --color_black: ${purifyCSS(theme.colors.black)};
        --color_light_black: ${purifyCSS(theme.colors.light_black)};
        --color_grey: ${purifyCSS(theme.colors.grey)};

        /* Used for error and warning modals */
        --color_red: ${purifyCSS(theme.colors.red) || "red"};
        --color_yellow: ${purifyCSS(theme.colors.yellow) || "yellow"};
    }

    body {
        font-family: var(--font_main), sans-serif;
        cursor: ${(window.settings.nocursorOverride || window.settings.nocursor) ? "none" : "default"} !important;
    }

    * {
       ${(window.settings.nocursorOverride || window.settings.nocursor) ? "cursor: none !important;" : ""}
    }

    ${purifyCSS(theme.injectCSS || "")}
    </style>`;

    window.theme = theme;
    window.theme.r = clampColor(theme.colors.r);
    window.theme.g = clampColor(theme.colors.g);
    window.theme.b = clampColor(theme.colors.b);
};

// Load theme JSON via electronAPI
const themeName = window.settings.theme;
try {
    const themeData = await window.electronAPI.getTheme(themeName);
    await window._loadTheme(themeData);
} catch (e) {
    console.error('[BOOT] Theme loading failed:', e);
    // Fallback theme so UI doesn't crash
    window.theme = { r: '0', g: '255', b: '255', colors: { r: '0', g: '255', b: '255' } };
}

// ============================================================
// Audio
// ============================================================
try {
    window.audioManager = await createAudioManager();
} catch (e) {
    console.error('[BOOT] Audio init failed:', e);
}

// ============================================================
// Graphical error handling (post-boot)
// ============================================================
function initGraphicalErrorHandling() {
    window.edexErrorsModals = [];
    window.onerror = (msg, path, line, col, error) => {
        let errorModal = new Modal({
            type: "error",
            title: error,
            message: `${msg}<br/>        at ${path}  ${line}:${col}`
        });
        window.edexErrorsModals.push(errorModal);

        console.error(`${error}: ${msg}`);
        console.debug(`at ${path} ${line}:${col}`);
    };
}

function waitForFonts() {
    return new Promise(resolve => {
        if (document.readyState !== "complete" || document.fonts.status !== "loaded") {
            document.addEventListener("readystatechange", () => {
                if (document.readyState === "complete") {
                    if (document.fonts.status === "loaded") {
                        resolve();
                    } else {
                        document.fonts.onloadingdone = () => {
                            if (document.fonts.status === "loaded") resolve();
                        };
                    }
                }
            });
        } else {
            resolve();
        }
    });
}

// ============================================================
// Boot sequence
// ============================================================
let bootLogLines = [];
let i = 0;

// Load boot log text
try {
    const bootLogText = await window.electronAPI.readAsset('misc/boot_log.txt');
    bootLogLines = bootLogText.split('\n');
} catch {
    bootLogLines = ['Welcome to eDEX-UI!', 'Boot Complete'];
}

let appVersion = await window.electronAPI.getAppVersion();

if (window.settings.nointro || window.settings.nointroOverride) {
    initGraphicalErrorHandling();
    document.getElementById("boot_screen").remove();
    document.body.setAttribute("class", "");
    waitForFonts().then(() => { initUI(); });
} else {
    displayLine();
}

// Startup boot log
function displayLine() {
    let bootScreen = document.getElementById("boot_screen");

    if (typeof bootLogLines[i] === "undefined") {
        setTimeout(displayTitleScreen, 300);
        return;
    }

    if (bootLogLines[i] === "Boot Complete") {
        window.audioManager.granted.play();
    } else {
        try { if (window.audioManager) window.audioManager.stdout.play(); } catch (e) { console.error('[BOOT] Audio play error:', e); }
    }
    bootScreen.innerHTML += bootLogLines[i] + "<br/>";
    i++;

    switch (true) {
        case i === 2:
            bootScreen.innerHTML += `eDEX-UI Kernel version ${appVersion} boot at ${Date().toString()}; root:xnu-1699.22.73~1/RELEASE_X86_64`;
            break;
        case i === 4:
            setTimeout(displayLine, 500);
            break;
        case i > 4 && i < 25:
            setTimeout(displayLine, 30);
            break;
        case i === 25:
            setTimeout(displayLine, 400);
            break;
        case i === 42:
            setTimeout(displayLine, 300);
            break;
        case i > 42 && i < 82:
            setTimeout(displayLine, 25);
            break;
        case i === 83:
            setTimeout(displayLine, 25);
            break;
        case i >= bootLogLines.length - 2 && i < bootLogLines.length:
            setTimeout(displayLine, 300);
            break;
        default:
            setTimeout(displayLine, Math.pow(1 - (i / 1000), 3) * 25);
    }
}

// Show "logo" and background grid
async function displayTitleScreen() {
    let bootScreen = document.getElementById("boot_screen");
    if (bootScreen === null) {
        bootScreen = document.createElement("section");
        bootScreen.setAttribute("id", "boot_screen");
        bootScreen.setAttribute("style", "z-index: 9999999");
        document.body.appendChild(bootScreen);
    }
    bootScreen.innerHTML = "";
    window.audioManager.theme.play();

    await delay(400);

    document.body.setAttribute("class", "");
    bootScreen.setAttribute("class", "center");
    bootScreen.innerHTML = "<h1>eDEX-UI</h1>";
    let title = document.querySelector("section > h1");

    await delay(200);

    document.body.setAttribute("class", "solidBackground");

    await delay(100);

    title.setAttribute("style", `background-color: rgb(${window.theme.r}, ${window.theme.g}, ${window.theme.b});border-bottom: 5px solid rgb(${window.theme.r}, ${window.theme.g}, ${window.theme.b});`);

    await delay(300);

    title.setAttribute("style", `border: 5px solid rgb(${window.theme.r}, ${window.theme.g}, ${window.theme.b});`);

    await delay(100);

    title.setAttribute("style", "");
    title.setAttribute("class", "glitch");

    await delay(500);

    document.body.setAttribute("class", "");
    title.setAttribute("class", "");
    title.setAttribute("style", `border: 5px solid rgb(${window.theme.r}, ${window.theme.g}, ${window.theme.b});`);

    await delay(1000);
    if (window.term) {
        bootScreen.remove();
        return true;
    }
    initGraphicalErrorHandling();
    waitForFonts().then(() => {
        bootScreen.remove();
        initUI();
    });
}

// ============================================================
// Get display name
// ============================================================
async function getDisplayName() {
    let user = window.settings.username;
    if (user) return user;
    return null;
}

// ============================================================
// Main UI initialization
// ============================================================
async function initUI() {
    document.body.innerHTML += `<section class="mod_column" id="mod_column_left">
        <h3 class="title"><p>PANEL</p><p>SYSTEM</p></h3>
    </section>
    <section id="main_shell" style="height:0%;width:0%;opacity:0;margin-bottom:30vh;" augmented-ui="bl-clip tr-clip exe">
        <h3 class="title" style="opacity:0;"><p>TERMINAL</p><p>MAIN SHELL</p></h3>
        <h1 id="main_shell_greeting"></h1>
    </section>
    <section class="mod_column" id="mod_column_right">
        <h3 class="title"><p>PANEL</p><p>NETWORK</p></h3>
    </section>`;

    await delay(10);

    window.audioManager.expand.play();
    document.getElementById("main_shell").setAttribute("style", "height:0%;margin-bottom:30vh;");

    await delay(500);

    document.getElementById("main_shell").setAttribute("style", "margin-bottom: 30vh;");
    document.querySelector("#main_shell > h3.title").setAttribute("style", "");

    await delay(700);

    document.getElementById("main_shell").setAttribute("style", "opacity: 0;");
    document.body.innerHTML += `
    <section id="filesystem" style="width: 0px;" class="${window.settings.hideDotfiles ? "hideDotfiles" : ""} ${window.settings.fsListView ? "list-view" : ""}">
    </section>
    <section id="keyboard" style="opacity:0;">
    </section>`;

    const kbLayoutPath = await window.electronAPI.getKeyboardPath(window.settings.keyboard + '.json');
    window.keyboard = await createKeyboard({
        layout: kbLayoutPath,
        container: "keyboard"
    });

    await delay(10);

    document.getElementById("main_shell").setAttribute("style", "");

    await delay(270);

    let greeter = document.getElementById("main_shell_greeting");

    getDisplayName().then(user => {
        if (user) {
            greeter.innerHTML += `Welcome back, <em>${escapeHtml(user)}</em>`;
        } else {
            greeter.innerHTML += "Welcome back";
        }
    });

    greeter.setAttribute("style", "opacity: 1;");

    document.getElementById("filesystem").setAttribute("style", "");
    document.getElementById("keyboard").setAttribute("style", "");
    document.getElementById("keyboard").setAttribute("class", "animation_state_1");
    window.audioManager.keyboard.play();

    await delay(100);

    document.getElementById("keyboard").setAttribute("class", "animation_state_1 animation_state_2");

    await delay(1000);

    greeter.setAttribute("style", "opacity: 0;");

    await delay(100);

    document.getElementById("keyboard").setAttribute("class", "");

    await delay(400);

    greeter.remove();

    // Initialize modules
    window.mods = {};

    // Left column (Phase 1: no Toplist)
    window.mods.clock = new Clock("mod_column_left");
    window.mods.sysinfo = new Sysinfo("mod_column_left");
    window.mods.hardwareInspector = new HardwareInspector("mod_column_left");
    window.mods.cpuinfo = new Cpuinfo("mod_column_left");
    window.mods.ramwatcher = new RAMwatcher("mod_column_left");

    // Right column (Phase 1: skipped - Netstat, Globe, Conninfo deferred)

    // Fade-in animations
    document.querySelectorAll(".mod_column").forEach(e => {
        e.setAttribute("class", "mod_column activated");
    });
    let modIdx = 0;
    let left = document.querySelectorAll("#mod_column_left > div");
    let right = document.querySelectorAll("#mod_column_right > div");
    let x = setInterval(() => {
        if (!left[modIdx] && !right[modIdx]) {
            clearInterval(x);
        } else {
            window.audioManager.panels.play();
            if (left[modIdx]) {
                left[modIdx].setAttribute("style", "animation-play-state: running;");
            }
            if (right[modIdx]) {
                right[modIdx].setAttribute("style", "animation-play-state: running;");
            }
            modIdx++;
        }
    }, 500);

    await delay(100);

    // Initialize the terminal (Phase 1: only tab 0)
    let shellContainer = document.getElementById("main_shell");
    shellContainer.innerHTML += `
        <ul id="main_shell_tabs">
            <li id="shell_tab0" onclick="window.focusShellTab(0);" class="active"><p>MAIN SHELL</p></li>
        </ul>
        <div id="main_shell_innercontainer">
            <pre id="terminal0" class="active"></pre>
        </div>`;

    window.term = {
        0: new Terminal({
            id: 0,
            parentId: "terminal0"
        })
    };
    window.currentTerm = 0;

    window.term[0].onprocesschange = p => {
        document.getElementById("shell_tab0").innerHTML = `<p>MAIN - ${escapeHtml(p)}</p>`;
    };
    // Prevent losing hardware keyboard focus on the terminal when using touch keyboard
    window.onmouseup = _e => {
        if (window.keyboard && window.keyboard.linkedToTerm) window.term[window.currentTerm].term.focus();
    };

    window.term[0].term.writeln("\x1b[1m" + `Welcome to eDEX-UI v${appVersion}` + "\x1b[0m");

    await delay(100);

    window.fsDisp = new FilesystemDisplay({ parentId: "filesystem" });

    window.term[0].oncwdchange = cwd => {
        if (window.fsDisp) window.fsDisp.readFS(cwd);
    };

    await delay(200);

    document.getElementById("filesystem").setAttribute("style", "opacity: 1;");

    // UpdateChecker deferred in Phase 1
}

// ============================================================
// Global functions
// ============================================================

window.themeChanger = theme => {
    window.electronAPI.setThemeOverride(theme);
    setTimeout(() => {
        window.location.reload(true);
    }, 100);
};

window.remakeKeyboard = async (layout) => {
    document.getElementById("keyboard").innerHTML = "";
    const kbLayoutPath = await window.electronAPI.getKeyboardPath(layout + '.json');
    window.keyboard = await createKeyboard({
        layout: kbLayoutPath,
        container: "keyboard"
    });
    window.electronAPI.setKbOverride(layout);
};

window.focusShellTab = number => {
    window.audioManager.folder.play();

    if (number !== window.currentTerm && window.term[number]) {
        window.currentTerm = number;

        document.querySelectorAll(`ul#main_shell_tabs > li:not(:nth-child(${number + 1}))`).forEach(e => {
            e.setAttribute("class", "");
        });
        document.getElementById("shell_tab" + number).setAttribute("class", "active");

        document.querySelectorAll(`div#main_shell_innercontainer > pre:not(:nth-child(${number + 1}))`).forEach(e => {
            e.setAttribute("class", "");
        });
        document.getElementById("terminal" + number).setAttribute("class", "active");

        if (window.term[number].fit) window.term[number].fit();
        if (window.term[number].term) window.term[number].term.focus();
        if (window.term[number].resendCWD) window.term[number].resendCWD();

        if (window.fsDisp) window.fsDisp.followTab();
    }
    // Phase 1: no additional tab creation (tabs 1-4 deferred)
};

// Settings editor
window.openSettings = async () => {
    if (document.getElementById("settingsEditor")) return;

    let keyboards = '', themes = '', monitors = '';

    const kbFiles = await window.electronAPI.readdir(await window.electronAPI.getAppPath('userData') + '/keyboards');
    kbFiles.forEach(kb => {
        if (!kb.endsWith(".json")) return;
        kb = kb.replace(".json", "");
        if (kb === window.settings.keyboard) return;
        keyboards += `<option>${kb}</option>`;
    });

    const thFiles = await window.electronAPI.readdir(await window.electronAPI.getAppPath('userData') + '/themes');
    thFiles.forEach(th => {
        if (!th.endsWith(".json")) return;
        th = th.replace(".json", "");
        if (th === window.settings.theme) return;
        themes += `<option>${th}</option>`;
    });

    const displays = await window.electronAPI.getDisplays();
    for (let d = 0; d < displays.length; d++) {
        if (d !== window.settings.monitor) monitors += `<option>${d}</option>`;
    }

    // Unlink the tactile keyboard from the terminal emulator
    window.keyboard.detach();

    new Modal({
        type: "custom",
        title: `Settings <i>(v${appVersion})</i>`,
        rawHtml: true,
        html: `<table id="settingsEditor">
                    <tr>
                        <th>Key</th>
                        <th>Description</th>
                        <th>Value</th>
                    </tr>
                    <tr>
                        <td>shell</td>
                        <td>The program to run as a terminal emulator</td>
                        <td><input type="text" id="settingsEditor-shell" value="${escapeHtml(window.settings.shell)}"></td>
                    </tr>
                    <tr>
                        <td>shellArgs</td>
                        <td>Arguments to pass to the shell</td>
                        <td><input type="text" id="settingsEditor-shellArgs" value="${escapeHtml(String(window.settings.shellArgs || ''))}"></td>
                    </tr>
                    <tr>
                        <td>cwd</td>
                        <td>Working Directory to start in</td>
                        <td><input type="text" id="settingsEditor-cwd" value="${escapeHtml(window.settings.cwd)}"></td>
                    </tr>
                    <tr>
                        <td>env</td>
                        <td>Custom shell environment override</td>
                        <td><input type="text" id="settingsEditor-env" value="${escapeHtml(String(window.settings.env || ''))}"></td>
                    </tr>
                    <tr>
                        <td>username</td>
                        <td>Custom username to display at boot</td>
                        <td><input type="text" id="settingsEditor-username" value="${escapeHtml(window.settings.username)}"></td>
                    </tr>
                    <tr>
                        <td>keyboard</td>
                        <td>On-screen keyboard layout code</td>
                        <td><select id="settingsEditor-keyboard">
                            <option>${window.settings.keyboard}</option>
                            ${keyboards}
                        </select></td>
                    </tr>
                    <tr>
                        <td>theme</td>
                        <td>Name of the theme to load</td>
                        <td><select id="settingsEditor-theme">
                            <option>${window.settings.theme}</option>
                            ${themes}
                        </select></td>
                    </tr>
                    <tr>
                        <td>termFontSize</td>
                        <td>Size of the terminal text in pixels</td>
                        <td><input type="number" id="settingsEditor-termFontSize" value="${window.settings.termFontSize}"></td>
                    </tr>
                    <tr>
                        <td>audio</td>
                        <td>Activate audio sound effects</td>
                        <td><select id="settingsEditor-audio">
                            <option>${window.settings.audio}</option>
                            <option>${!window.settings.audio}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>audioVolume</td>
                        <td>Set default volume for sound effects (0.0 - 1.0)</td>
                        <td><input type="number" id="settingsEditor-audioVolume" value="${window.settings.audioVolume || '1.0'}"></td>
                    </tr>
                    <tr>
                        <td>disableFeedbackAudio</td>
                        <td>Disable recurring feedback sound FX</td>
                        <td><select id="settingsEditor-disableFeedbackAudio">
                            <option>${window.settings.disableFeedbackAudio}</option>
                            <option>${!window.settings.disableFeedbackAudio}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>port</td>
                        <td>Local port to use for UI-shell connection</td>
                        <td><input type="number" id="settingsEditor-port" value="${window.settings.port}"></td>
                    </tr>
                    <tr>
                        <td>pingAddr</td>
                        <td>IPv4 address to test Internet connectivity</td>
                        <td><input type="text" id="settingsEditor-pingAddr" value="${window.settings.pingAddr || "1.1.1.1"}"></td>
                    </tr>
                    <tr>
                        <td>clockHours</td>
                        <td>Clock format (12/24 hours)</td>
                        <td><select id="settingsEditor-clockHours">
                            <option>${(window.settings.clockHours === 12) ? "12" : "24"}</option>
                            <option>${(window.settings.clockHours === 12) ? "24" : "12"}</option>
                        </select></td>
                    <tr>
                        <td>monitor</td>
                        <td>Which monitor to spawn the UI in</td>
                        <td><select id="settingsEditor-monitor">
                            ${(typeof window.settings.monitor !== "undefined") ? "<option>" + window.settings.monitor + "</option>" : ""}
                            ${monitors}
                        </select></td>
                    </tr>
                    <tr>
                        <td>nointro</td>
                        <td>Skip the intro boot log and logo${(window.settings.nointroOverride) ? " (Currently overridden by CLI flag)" : ""}</td>
                        <td><select id="settingsEditor-nointro">
                            <option>${window.settings.nointro}</option>
                            <option>${!window.settings.nointro}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>nocursor</td>
                        <td>Hide the mouse cursor${(window.settings.nocursorOverride) ? " (Currently overridden by CLI flag)" : ""}</td>
                        <td><select id="settingsEditor-nocursor">
                            <option>${window.settings.nocursor}</option>
                            <option>${!window.settings.nocursor}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>allowWindowed</td>
                        <td>Allow using F11 key to set the UI in windowed mode</td>
                        <td><select id="settingsEditor-allowWindowed">
                            <option>${window.settings.allowWindowed}</option>
                            <option>${!window.settings.allowWindowed}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>keepGeometry</td>
                        <td>Try to keep a 16:9 aspect ratio in windowed mode</td>
                        <td><select id="settingsEditor-keepGeometry">
                            <option>${(window.settings.keepGeometry === false) ? 'false' : 'true'}</option>
                            <option>${(window.settings.keepGeometry === false) ? 'true' : 'false'}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>hideDotfiles</td>
                        <td>Hide files and directories starting with a dot</td>
                        <td><select id="settingsEditor-hideDotfiles">
                            <option>${window.settings.hideDotfiles}</option>
                            <option>${!window.settings.hideDotfiles}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>fsListView</td>
                        <td>Show files in a detailed list instead of icon grid</td>
                        <td><select id="settingsEditor-fsListView">
                            <option>${window.settings.fsListView}</option>
                            <option>${!window.settings.fsListView}</option>
                        </select></td>
                    </tr>
                </table>
                <h6 id="settingsEditorStatus">Loaded values from memory</h6>
                <br>`,
        buttons: [
            { label: "Save to Disk", action: "writeSettings" },
            { label: "Reload UI", action: "reload" }
        ]
    }, () => {
        // Link the keyboard back to the terminal
        window.keyboard.attach();

        // Focus back on the term
        if (window.term[window.currentTerm] && window.term[window.currentTerm].term) {
            window.term[window.currentTerm].term.focus();
        }
    });
};

window.writeFile = async (filePath) => {
    await window.electronAPI.writeFile(filePath, document.getElementById("fileEdit").value);
    document.getElementById("fedit-status").innerHTML = "<i>File saved.</i>";
};

window.writeSettingsFile = async () => {
    window.settings = {
        shell: document.getElementById("settingsEditor-shell").value,
        shellArgs: document.getElementById("settingsEditor-shellArgs").value,
        cwd: document.getElementById("settingsEditor-cwd").value,
        env: document.getElementById("settingsEditor-env").value,
        username: document.getElementById("settingsEditor-username").value,
        keyboard: document.getElementById("settingsEditor-keyboard").value,
        theme: document.getElementById("settingsEditor-theme").value,
        termFontSize: Number(document.getElementById("settingsEditor-termFontSize").value),
        audio: (document.getElementById("settingsEditor-audio").value === "true"),
        audioVolume: Number(document.getElementById("settingsEditor-audioVolume").value),
        disableFeedbackAudio: (document.getElementById("settingsEditor-disableFeedbackAudio").value === "true"),
        pingAddr: document.getElementById("settingsEditor-pingAddr").value,
        clockHours: Number(document.getElementById("settingsEditor-clockHours").value),
        port: Number(document.getElementById("settingsEditor-port").value),
        monitor: Number(document.getElementById("settingsEditor-monitor").value),
        nointro: (document.getElementById("settingsEditor-nointro").value === "true"),
        nocursor: (document.getElementById("settingsEditor-nocursor").value === "true"),
        allowWindowed: (document.getElementById("settingsEditor-allowWindowed").value === "true"),
        keepGeometry: (document.getElementById("settingsEditor-keepGeometry").value === "true"),
        hideDotfiles: (document.getElementById("settingsEditor-hideDotfiles").value === "true"),
        fsListView: (document.getElementById("settingsEditor-fsListView").value === "true")
    };

    Object.keys(window.settings).forEach(key => {
        if (window.settings[key] === "undefined") {
            delete window.settings[key];
        }
    });

    await window.electronAPI.saveSettings(window.settings);
    document.getElementById("settingsEditorStatus").innerText = "New values written to settings.json file at " + new Date().toTimeString();
};

// Toggle fullscreen via electronAPI
window.toggleFullScreen = async () => {
    await window.electronAPI.toggleFullscreen();
};

// Shortcuts help
window.openShortcutsHelp = () => {
    if (document.getElementById("settingsEditor")) return;

    const shortcutsDefinition = {
        "COPY": "Copy selected buffer from the terminal.",
        "PASTE": "Paste system clipboard to the terminal.",
        "NEXT_TAB": "Switch to the next opened terminal tab.",
        "PREVIOUS_TAB": "Switch to the previous opened terminal tab.",
        "TAB_X": "Switch to terminal tab <strong>X</strong>, or create it.",
        "SETTINGS": "Open the settings editor.",
        "SHORTCUTS": "List and edit available keyboard shortcuts.",
        "FUZZY_SEARCH": "Search for entries in the current working directory.",
        "FS_LIST_VIEW": "Toggle between list and grid view in the file browser.",
        "FS_DOTFILES": "Toggle hidden files and directories.",
        "KB_PASSMODE": "Toggle password mode on the on-screen keyboard.",
        "DEV_DEBUG": "Open Chromium Dev Tools.",
        "DEV_RELOAD": "Trigger front-end hot reload."
    };

    let appList = "";
    window.shortcuts.filter(e => e.type === "app").forEach(cut => {
        let action = (cut.action.startsWith("TAB_")) ? "TAB_X" : cut.action;
        appList += `<tr>
                        <td>${(cut.enabled) ? 'YES' : 'NO'}</td>
                        <td><input disabled type="text" maxlength=25 value="${escapeHtml(cut.trigger)}"></td>
                        <td>${shortcutsDefinition[action]}</td>
                    </tr>`;
    });

    let customList = "";
    window.shortcuts.filter(e => e.type === "shell").forEach(cut => {
        customList += `<tr>
                            <td>${(cut.enabled) ? 'YES' : 'NO'}</td>
                            <td><input disabled type="text" maxlength=25 value="${escapeHtml(cut.trigger)}"></td>
                            <td>
                                <input disabled type="text" placeholder="Run terminal command..." value="${escapeHtml(cut.action)}">
                                <input disabled type="checkbox" name="shortcutsHelpNew_Enter" ${(cut.linebreak) ? 'checked' : ''}>
                                <label for="shortcutsHelpNew_Enter">Enter</label>
                            </td>
                        </tr>`;
    });

    window.keyboard.detach();
    new Modal({
        type: "custom",
        title: `Available Keyboard Shortcuts <i>(v${appVersion})</i>`,
        rawHtml: true,
        html: `<h5>Using either the on-screen or a physical keyboard, you can use the following shortcuts:</h5>
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
                        <tr>
                       ${customList}
                    </table>
                </details>
                <br>`,
        buttons: [
            { label: "Reload UI", action: "reload" }
        ]
    }, () => {
        window.keyboard.attach();
        if (window.term[window.currentTerm] && window.term[window.currentTerm].term) {
            window.term[window.currentTerm].term.focus();
        }
    });

    let wrap1 = document.getElementById('shortcutsHelpAccordeon1');
    let wrap2 = document.getElementById('shortcutsHelpAccordeon2');

    wrap1.addEventListener('toggle', _e => {
        wrap2.open = !wrap1.open;
    });

    wrap2.addEventListener('toggle', _e => {
        wrap1.open = !wrap2.open;
    });
};

// App shortcut handler
window.useAppShortcut = action => {
    switch (action) {
        case "COPY":
            if (window.term[window.currentTerm] && window.term[window.currentTerm].clipboard) {
                window.term[window.currentTerm].clipboard.copy();
            }
            return true;
        case "PASTE":
            if (window.term[window.currentTerm] && window.term[window.currentTerm].clipboard) {
                window.term[window.currentTerm].clipboard.paste();
            }
            return true;
        case "NEXT_TAB":
            if (window.term[window.currentTerm + 1]) {
                window.focusShellTab(window.currentTerm + 1);
            } else {
                window.focusShellTab(0);
            }
            return true;
        case "PREVIOUS_TAB": {
            let j = window.currentTerm || 4;
            if (window.term[j] && j !== window.currentTerm) {
                window.focusShellTab(j);
            } else if (window.term[j - 1]) {
                window.focusShellTab(j - 1);
            }
            return true;
        }
        case "TAB_1":
            window.focusShellTab(0);
            return true;
        case "TAB_2":
        case "TAB_3":
        case "TAB_4":
        case "TAB_5":
            // Phase 1: only tab 0
            return true;
        case "SETTINGS":
            window.openSettings();
            return true;
        case "SHORTCUTS":
            window.openShortcutsHelp();
            return true;
        case "FS_LIST_VIEW":
            if (window.fsDisp) window.fsDisp.toggleListview();
            return true;
        case "FS_DOTFILES":
            if (window.fsDisp) window.fsDisp.toggleHidedotfiles();
            return true;
        case "KB_PASSMODE":
            window.keyboard.togglePasswordMode();
            return true;
        case "DEV_DEBUG":
            // Dev tools toggle via main process
            return true;
        case "DEV_RELOAD":
            window.location.reload(true);
            return true;
        default:
            console.warn(`Unknown "${action}" app shortcut action`);
            return false;
    }
};

// Register keyboard shortcuts via electronAPI
window.registerKeyboardShortcuts = () => {
    window.shortcuts.forEach(cut => {
        if (!cut.enabled) return;

        if (cut.type === "app") {
            if (cut.action === "TAB_X") {
                for (let idx = 1; idx <= 5; idx++) {
                    let trigger = cut.trigger.replace("X", idx);
                    window.electronAPI.registerShortcut(trigger, `TAB_${idx}`);
                }
            } else {
                window.electronAPI.registerShortcut(cut.trigger, cut.action);
            }
        } else if (cut.type === "shell") {
            window.electronAPI.registerShortcut(cut.trigger, `SHELL:${cut.action}:${cut.linebreak ? '1' : '0'}`);
        }
    });
};

// Listen for shortcut triggers from main process
window.electronAPI.onShortcutTriggered((id) => {
    if (id.startsWith("SHELL:")) {
        let parts = id.split(":");
        let cmd = parts[1];
        let linebreak = parts[2] === '1';
        if (window.term[window.currentTerm]) {
            let fn = linebreak ? "writelr" : "write";
            window.term[window.currentTerm][fn](cmd);
        }
    } else {
        window.useAppShortcut(id);
    }
});

window.registerKeyboardShortcuts();

window.addEventListener("focus", () => {
    window.registerKeyboardShortcuts();
});

window.addEventListener("blur", () => {
    // Unregister all - main process handles this
});

// Prevent showing menu, exiting fullscreen or app with keyboard shortcuts
document.addEventListener("keydown", e => {
    if (e.key === "Alt") {
        e.preventDefault();
    }
    if (e.code.startsWith("Alt") && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
    }
    if (e.key === "F11" && !window.settings.allowWindowed) {
        e.preventDefault();
    }
    if (e.code === "KeyD" && e.ctrlKey) {
        e.preventDefault();
    }
    if (e.code === "KeyA" && e.ctrlKey) {
        e.preventDefault();
    }
});

// Fix double-tap zoom on touchscreens
// Note: webFrame not available in renderer with contextIsolation
// This needs to be handled in preload or main process

// Resize terminal with window
window.onresize = () => {
    if (typeof window.currentTerm !== "undefined") {
        if (typeof window.term[window.currentTerm] !== "undefined") {
            if (window.term[window.currentTerm].fit) {
                window.term[window.currentTerm].fit();
            }
        }
    }
};
