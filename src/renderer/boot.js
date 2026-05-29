// eDEX-UI boot sequence utilities (ES module port)
// Extracted from main.js for testability

/**
 * Clamp a color value to a valid integer in [0, 255].
 * Returns 0 for non-numeric, NaN, or missing values.
 * @param {*} v
 * @returns {number}
 */
function clampColor(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.min(255, Math.max(0, Math.round(n)));
}

/**
 * Load boot log text from the misc/boot_log.txt asset.
 * @param {object} electronAPI - window.electronAPI or compatible mock
 * @returns {Promise<string[]>} array of lines
 */
export async function loadBootLog(electronAPI) {
    try {
        const text = await electronAPI.readAsset('misc/boot_log.txt');
        const lines = text.split('\n');
        if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
            return ['Welcome to eDEX-UI!', 'Boot Complete'];
        }
        return lines;
    } catch {
        return ['Welcome to eDEX-UI!', 'Boot Complete'];
    }
}

/**
 * Wait for document fonts to finish loading.
 * Resolves when document.fonts.status === 'loaded' and document.readyState === 'complete'.
 * @returns {Promise<void>}
 */
export function waitForFonts() {
    return new Promise(resolve => {
        const checkAndResolve = () => {
            if (document.readyState === 'complete' && document.fonts.status === 'loaded') {
                resolve();
                return true;
            }
            return false;
        };

        if (checkAndResolve()) return;

        // If readyState is complete but fonts are still loading, listen for fonts
        if (document.readyState === 'complete') {
            document.fonts.onloadingdone = () => checkAndResolve();
        } else {
            // Wait for readyState, then check fonts
            document.addEventListener('readystatechange', () => {
                if (document.readyState === 'complete') {
                    if (!checkAndResolve()) {
                        document.fonts.onloadingdone = () => checkAndResolve();
                    }
                }
            });
        }
    });
}

/**
 * Display the eDEX-UI title screen animation.
 * Creates a boot_screen section, animates the title, plays theme audio,
 * then calls onInitUI and removes the boot_screen.
 *
 * @param {object} opts
 * @param {{ r: string, g: string, b: string }} opts.theme
 * @param {function} opts.onInitUI - called after animation completes
 * @returns {Promise<boolean>} true if skipped (window.term already exists)
 */
export async function displayTitleScreen({ theme, onInitUI } = {}) {
    // Skip path: if window.term already exists, remove boot_screen and return early
    if (window.term) {
        const existing = document.getElementById('boot_screen');
        if (existing) existing.remove();
        return true;
    }

    await waitForFonts();

    // Play theme audio
    if (window.audioManager && window.audioManager.theme) {
        window.audioManager.theme.play();
    }

    // Get or create boot_screen
    let bootScreen = document.getElementById('boot_screen');
    if (!bootScreen) {
        bootScreen = document.createElement('section');
        bootScreen.id = 'boot_screen';
        document.body.appendChild(bootScreen);
    } else {
        bootScreen.innerHTML = '';
    }

    // Create title element
    const h1 = document.createElement('h1');
    h1.textContent = 'eDEX-UI';
    if (theme) {
        h1.style.borderBottom = `2px solid rgb(${clampColor(theme.r)}, ${clampColor(theme.g)}, ${clampColor(theme.b)})`;
    }
    bootScreen.appendChild(h1);

    // Simulate animation delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Cleanup
    bootScreen.remove();

    // Callback
    if (onInitUI) onInitUI();

    return undefined;
}
