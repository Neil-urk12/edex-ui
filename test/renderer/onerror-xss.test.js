// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mainSrcPath = resolve(__dirname, '../../src/renderer/main.js');

const mainSrc = readFileSync(mainSrcPath, 'utf-8');

describe('onerror XSS — source-code assertions', () => {
    // Extract the window.onerror block from main.js
    const onerrorMatch = mainSrc.match(
        /window\.onerror\s*=\s*\(.*?\)\s*=>\s*\{([\s\S]*?)\n\};/
    );

    it('finds the window.onerror handler in main.js', () => {
        expect(onerrorMatch).not.toBeNull();
    });

    it('imports escapeHtml from utils.js', () => {
        expect(mainSrc).toMatch(
            /import\s*\{[^}]*escapeHtml[^}]*\}\s*from\s*['"]\.\/utils\.js['"]/
        );
    });

    it('uses escapeHtml to sanitize error output', () => {
        expect(onerrorMatch).not.toBeNull();
        const handlerBody = onerrorMatch[1];
        expect(handlerBody).toMatch(/escapeHtml\(/);
    });

    it('does NOT inject raw msg into innerHTML', () => {
        expect(onerrorMatch).not.toBeNull();
        const handlerBody = onerrorMatch[1];
        // The handler must not use unescaped ${msg} in a template literal
        expect(handlerBody).not.toMatch(/\$\{msg\}/);
    });

    it('does NOT inject raw error into innerHTML', () => {
        expect(onerrorMatch).not.toBeNull();
        const handlerBody = onerrorMatch[1];
        // The handler must not use unescaped ${error} in a template literal
        expect(handlerBody).not.toMatch(/\$\{error\}/);
    });

    it('does NOT inject raw path into innerHTML', () => {
        expect(onerrorMatch).not.toBeNull();
        const handlerBody = onerrorMatch[1];
        // The handler must not use unescaped ${path} in a template literal
        expect(handlerBody).not.toMatch(/\$\{path\}/);
    });
});
