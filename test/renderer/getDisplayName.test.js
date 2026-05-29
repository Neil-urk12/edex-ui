// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mainPath = resolve(__dirname, '../../src/renderer/main.js');

describe('getDisplayName', () => {
    it('is defined in main.js', () => {
        const src = readFileSync(mainPath, 'utf-8');
        expect(src).toMatch(/function\s+getDisplayName\s*\(\s*\)/);
    });

    it('does not have unreachable code after early return', () => {
        const src = readFileSync(mainPath, 'utf-8');

        // Extract the getDisplayName function body
        const fnMatch = src.match(
            /async\s+function\s+getDisplayName\s*\(\s*\)\s*\{([\s\S]*?)\n\}/
        );
        expect(fnMatch).toBeTruthy();

        const body = fnMatch[1].trim();
        const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // Find the early return line: if (user) return user;
        const earlyReturnIdx = lines.findIndex(l =>
            /if\s*\(\s*user\s*\)\s*return\s+user\s*;/.test(l)
        );
        expect(earlyReturnIdx).toBeGreaterThanOrEqual(0);

        // After the early return, the only remaining statement should be
        // the final return (e.g., "return null;" or "return undefined;")
        // There should NOT be a bare "return user;" as dead code
        const afterEarlyReturn = lines.slice(earlyReturnIdx + 1);
        for (const line of afterEarlyReturn) {
            // Allow: return null, return undefined, return user ?? null, etc.
            // Disallow: bare "return user;" which is dead code
            expect(line).not.toMatch(/^return\s+user\s*;$/);
        }
    });

    it('returns the username when settings.username is truthy', async () => {
        // We cannot easily import main.js (it has top-level await and side effects),
        // so we test by extracting and evaluating the function in isolation.

        const src = readFileSync(mainPath, 'utf-8');
        const fnMatch = src.match(
            /async\s+function\s+getDisplayName\s*\(\s*\)\s*\{([\s\S]*?)\n\}/
        );
        expect(fnMatch).toBeTruthy();

        // Reconstruct a callable version using eval in a controlled scope
        const fnBody = fnMatch[1];
        const fn = new Function('window', `return (async function getDisplayName() {${fnBody}})();`);

        const result = await fn({ settings: { username: 'alice' } });
        expect(result).toBe('alice');
    });

    it('returns null/undefined when settings.username is not set', async () => {
        const src = readFileSync(mainPath, 'utf-8');
        const fnMatch = src.match(
            /async\s+function\s+getDisplayName\s*\(\s*\)\s*\{([\s\S]*?)\n\}/
        );
        expect(fnMatch).toBeTruthy();

        const fnBody = fnMatch[1];
        const fn = new Function('window', `return (async function getDisplayName() {${fnBody}})();`);

        const result = await fn({ settings: {} });
        expect(result == null).toBe(true); // null or undefined
    });

    it('returns null/undefined when settings.username is empty string', async () => {
        const src = readFileSync(mainPath, 'utf-8');
        const fnMatch = src.match(
            /async\s+function\s+getDisplayName\s*\(\s*\)\s*\{([\s\S]*?)\n\}/
        );
        expect(fnMatch).toBeTruthy();

        const fnBody = fnMatch[1];
        const fn = new Function('window', `return (async function getDisplayName() {${fnBody}})();`);

        const result = await fn({ settings: { username: '' } });
        expect(result == null).toBe(true); // null or undefined (empty string is falsy)
    });
});
