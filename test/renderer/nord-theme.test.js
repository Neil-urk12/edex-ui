// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import nordTheme from '../../src/assets/themes/nord.json';
import cyborgTheme from '../../src/assets/themes/cyborg.json';

// ---------------------------------------------------------------------------
// Tests for nord.json theme key standardization.
//
// The terminal.class.js reads these keys from the theme:
//   - window.theme.terminal.cursorAccent   (line 106)
//   - window.theme.colors.brightBlack      (line 116, with fallback)
//
// cyborg.json uses the standard `bright*` keys and has `cursorAccent`.
// nord.json currently uses non-standard `light*` keys and is missing
// `cursorAccent`.
//
// After the Phase 1 fix, nord.json MUST:
//   1. Rename light* keys to bright* (matching cyborg and terminal.class.js)
//   2. Add terminal.cursorAccent
//
// These tests WILL FAIL until nord.json is fixed.
// ---------------------------------------------------------------------------

describe('nord.json terminal section', () => {
    it('has terminal.cursorAccent defined', () => {
        expect(nordTheme.terminal.cursorAccent).toBeDefined();
        expect(typeof nordTheme.terminal.cursorAccent).toBe('string');
    });
});

describe('nord.json color keys follow bright* convention', () => {
    // These are the standard bright* keys that terminal.class.js expects.
    const requiredBrightKeys = [
        'brightBlack',
        'brightRed',
        'brightGreen',
        'brightYellow',
        'brightBlue',
        'brightMagenta',
        'brightCyan',
        'brightWhite',
    ];

    requiredBrightKeys.forEach((key) => {
        it(`has colors.${key} defined`, () => {
            expect(nordTheme.colors[key]).toBeDefined();
        });

        it(`colors.${key} is a valid hex color string`, () => {
            expect(nordTheme.colors[key]).toMatch(/^#[0-9a-fA-F]{6}$/);
        });
    });
});

describe('nord.json does not use legacy light* color keys', () => {
    const legacyLightKeys = [
        'lightBlack',
        'lightRed',
        'lightGreen',
        'lightYellow',
        'lightBlue',
        'lightMagenta',
        'lightCyan',
        'lightWhite',
    ];

    legacyLightKeys.forEach((key) => {
        it(`does not have colors.${key} (should be renamed to bright*)`, () => {
            expect(nordTheme.colors[key]).toBeUndefined();
        });
    });
});

describe('nord.json vs cyborg.json key parity', () => {
    it('has the same set of color keys as cyborg.json', () => {
        const nordColorKeys = Object.keys(nordTheme.colors).sort();
        const cyborgColorKeys = Object.keys(cyborgTheme.colors).sort();

        // Both should have the same key names (excluding metas like r,g,b)
        const standardKeys = [
            'black',
            'red',
            'green',
            'yellow',
            'blue',
            'magenta',
            'cyan',
            'white',
            'brightBlack',
            'brightRed',
            'brightGreen',
            'brightYellow',
            'brightBlue',
            'brightMagenta',
            'brightCyan',
            'brightWhite',
        ];

        standardKeys.forEach((key) => {
            expect(nordTheme.colors).toHaveProperty(key);
            expect(cyborgTheme.colors).toHaveProperty(key);
        });
    });

    it('has the same set of terminal keys as cyborg.json', () => {
        const nordTerminalKeys = Object.keys(nordTheme.terminal).sort();
        const cyborgTerminalKeys = Object.keys(cyborgTheme.terminal).sort();

        expect(nordTerminalKeys).toEqual(cyborgTerminalKeys);
    });
});
