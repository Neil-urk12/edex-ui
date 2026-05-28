// Security: disable eval
window.eval = globalThis.eval = function () {
    throw new Error("eval() is disabled for security reasons.");
};

// Security helper
export function escapeHtml(text) {
    let map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => { return map[m]; });
}

export function encodePathURI(uri) {
    return encodeURI(uri).replace(/#/g, "%23");
}

export function purifyCSS(str) {
    if (typeof str === "undefined") return "";
    if (typeof str !== "string") {
        str = str.toString();
    }
    return str.replace(/[<]/g, "");
}

export function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Get the OS platform in Node.js format.
 * Uses navigator.userAgentData?.platform with navigator.platform fallback.
 * Returns 'win32', 'darwin', or 'linux'.
 */
export function getPlatform() {
    const ua = navigator.userAgentData?.platform;
    const p = (ua || navigator.platform || '').toLowerCase();
    if (p.includes('win')) return 'win32';
    if (p.includes('mac')) return 'darwin';
    return 'linux';
}

// Register on window for backward compat with inline handlers
window._escapeHtml = escapeHtml;
window._encodePathURI = encodePathURI;
window._purifyCSS = purifyCSS;
window._delay = delay;
window._getPlatform = getPlatform;

export { escapeHtml as _escapeHtml, encodePathURI as _encodePathURI, purifyCSS as _purifyCSS, delay as _delay, getPlatform as _getPlatform };