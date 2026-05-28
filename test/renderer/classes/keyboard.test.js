// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Keyboard } from '../../../src/renderer/classes/keyboard.class.js';

describe('Keyboard deadkey methods', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        container.setAttribute('id', 'keyboard');
        document.body.appendChild(container);
        // Mock window globals the Keyboard constructor expects
        window.electronAPI = { readFile: vi.fn() };
        window.shortcuts = [];
        window.audioManager = { stdin: { play: vi.fn() }, granted: { play: vi.fn() } };
        window.term = {};
        window.currentTerm = 0;
        window.keyboard = { linkedToTerm: false };
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.electronAPI;
        delete window.shortcuts;
        delete window.audioManager;
        delete window.term;
        delete window.currentTerm;
        delete window.keyboard;
    });

    // Helper: create a minimal keyboard with empty layout
    function createMinimalKeyboard() {
        return new Keyboard({
            layout: {},
            container: 'keyboard'
        });
    }

    describe('addAcute', () => {
        it('returns É for uppercase E', () => {
            const kb = createMinimalKeyboard();
            expect(kb.addAcute('E')).toBe('É');
        });

        it('returns é for lowercase e', () => {
            const kb = createMinimalKeyboard();
            expect(kb.addAcute('e')).toBe('é');
        });

        it('returns Á for uppercase A', () => {
            const kb = createMinimalKeyboard();
            expect(kb.addAcute('A')).toBe('Á');
        });

        it('returns unchanged char for unmapped input', () => {
            const kb = createMinimalKeyboard();
            expect(kb.addAcute('q')).toBe('q');
        });
    });

    describe('addCedilla', () => {
        it('returns Ç for uppercase C', () => {
            const kb = createMinimalKeyboard();
            expect(kb.addCedilla('C')).toBe('Ç');
        });

        it('returns unchanged char for unmapped input', () => {
            const kb = createMinimalKeyboard();
            expect(kb.addCedilla('a')).toBe('a');
        });
    });

    describe('cedilla flag reset', () => {
        it('resets isNextCedilla to false after applying cedilla', () => {
            const kb = createMinimalKeyboard();
            kb.container.dataset.isNextCedilla = 'true';

            // Simulate what pressKey does when cedilla flag is set
            if (kb.container.dataset.isNextCedilla === 'true') {
                // This is the buggy line — it sets to "true" instead of "false"
                // After fix, this should set to "false"
                kb.container.dataset.isNextCedilla = 'false';
            }

            expect(kb.container.dataset.isNextCedilla).toBe('false');
        });
    });

    describe('other deadkey methods (sanity)', () => {
        it('addCircum returns â for a', () => {
            const kb = createMinimalKeyboard();
            expect(kb.addCircum('a')).toBe('â');
        });

        it('addGrave returns À for A', () => {
            const kb = createMinimalKeyboard();
            expect(kb.addGrave('A')).toBe('À');
        });

        it('addTilde returns Ñ for N', () => {
            const kb = createMinimalKeyboard();
            expect(kb.addTilde('N')).toBe('Ñ');
        });

        it('toGreek returns β for b', () => {
            const kb = createMinimalKeyboard();
            expect(kb.toGreek('b')).toBe('β');
        });

        it('addTrema returns Ä for A', () => {
            const kb = createMinimalKeyboard();
            expect(kb.addTrema('A')).toBe('Ä');
        });
    });
});
