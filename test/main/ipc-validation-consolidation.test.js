import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateWithin } from '../../src/main/ipc-validation.js';

describe('validateWithin — directory-itself security (post-consolidation)', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'edex-consolidation-test-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('rejects resolving to the allowed directory itself', () => {
        const allowedDir = join(tmpDir, 'allowed');
        mkdirSync(allowedDir, { recursive: true });
        expect(() => validateWithin(allowedDir, allowedDir)).toThrow(/Access denied/);
    });

    it('allows valid file within directory', () => {
        const allowedDir = join(tmpDir, 'allowed');
        mkdirSync(join(allowedDir, 'sub'), { recursive: true });
        writeFileSync(join(allowedDir, 'sub', 'file.txt'), 'ok');
        const result = validateWithin(join(allowedDir, 'sub', 'file.txt'), allowedDir);
        expect(result).toContain('allowed');
    });

    it('rejects path outside directory', () => {
        const allowedDir = join(tmpDir, 'allowed');
        const outsideDir = join(tmpDir, 'outside');
        mkdirSync(allowedDir, { recursive: true });
        mkdirSync(outsideDir, { recursive: true });
        writeFileSync(join(outsideDir, 'file.txt'), 'nope');
        expect(() => validateWithin(join(outsideDir, 'file.txt'), allowedDir)).toThrow(/Access denied/);
    });

    it('valid file paths still work after consolidation', () => {
        const userData = join(tmpDir, 'userData');
        mkdirSync(userData, { recursive: true });
        writeFileSync(join(userData, 'settings.json'), '{}');
        const result = validateWithin(join(userData, 'settings.json'), userData);
        expect(result).toContain('settings.json');
    });

    it('nested paths still work', () => {
        const userData = join(tmpDir, 'userData');
        mkdirSync(join(userData, 'themes', 'dark'), { recursive: true });
        writeFileSync(join(userData, 'themes', 'dark', 'theme.json'), '{}');
        const result = validateWithin(join(userData, 'themes', 'dark', 'theme.json'), userData);
        expect(result).toContain('theme.json');
    });
});
