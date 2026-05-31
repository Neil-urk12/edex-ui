import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const srcDir = resolve(__dirname, '../../src/renderer');

function readSrc(relativePath) {
    return readFileSync(resolve(srcDir, relativePath), 'utf-8');
}

describe('magic numbers eliminated', () => {
    it('terminal.class.js uses TERMINAL_DEFAULTS.FONT_SIZE', () => {
        const src = readSrc('classes/terminal.class.js');
        expect(src).toContain('TERMINAL_DEFAULTS.FONT_SIZE');
    });

    it('terminal.class.js uses TERMINAL_DEFAULTS.SCROLLBACK', () => {
        const src = readSrc('classes/terminal.class.js');
        expect(src).toContain('TERMINAL_DEFAULTS.SCROLLBACK');
    });

    it('audiofx.class.js uses AUDIO_DEFAULTS.VOLUME', () => {
        const src = readSrc('classes/audiofx.class.js');
        expect(src).toContain('AUDIO_DEFAULTS.VOLUME');
    });

    it('modal.class.js uses Z_INDEX constants', () => {
        const src = readSrc('classes/modal.class.js');
        expect(src).toContain('Z_INDEX.ERROR_MODAL');
        expect(src).toContain('Z_INDEX.WARNING_MODAL');
        expect(src).toContain('Z_INDEX.INFO_MODAL');
    });

    it('keyboard.class.js uses UI_TIMING constants', () => {
        const src = readSrc('classes/keyboard.class.js');
        expect(src).toContain('UI_TIMING.KEY_HOLD_INTERVAL');
        expect(src).toContain('UI_TIMING.KEY_HOLD_TIMEOUT');
        expect(src).toContain('UI_TIMING.KEY_BLINK_DURATION');
    });
});
