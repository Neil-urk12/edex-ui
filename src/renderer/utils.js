// Security: disable eval
window.eval = globalThis.eval = function () {
    throw new Error("eval() is disabled for security reasons.");
};

// Security helper
export function escapeHtml(text) {
    if (text == null) return '';
    if (typeof text !== 'string') text = String(text);
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

export function clampColor(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.min(255, Math.max(0, Math.round(n)));
}
