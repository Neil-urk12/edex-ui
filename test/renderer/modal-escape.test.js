// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const modalSrcPath = resolve(__dirname, '../../src/renderer/classes/modal.class.js');
const utilsSrcPath = resolve(__dirname, '../../src/renderer/utils.js');

describe('modal.class.js escapeHtml deduplication', () => {
    it('does NOT export _esc function', async () => {
        const mod = await import('../../src/renderer/classes/modal.class.js');
        expect(mod._esc).toBeUndefined();
    });

    it('imports escapeHtml from utils.js', () => {
        const src = readFileSync(modalSrcPath, 'utf-8');
        // Should have an import of escapeHtml from utils.js
        expect(src).toMatch(/import\s*\{[^}]*escapeHtml[^}]*\}\s*from\s*['"]\.{1,2}\/utils\.js['"]/);
    });

    it('does NOT define its own _esc helper', () => {
        const src = readFileSync(modalSrcPath, 'utf-8');
        // Should not have a local _esc definition
        expect(src).not.toMatch(/(?:const|let|var|export\s+const)\s+_esc\s*=/);
    });

    it('references escapeHtml (not _esc) in DOM construction', () => {
        const src = readFileSync(modalSrcPath, 'utf-8');
        // The DOM string builder should call escapeHtml, not _esc
        expect(src).toMatch(/escapeHtml\(/);
        expect(src).not.toMatch(/(?<!\w)_esc\s*\(/);
    });
});

describe('Modal HTML escaping behavior', () => {
    let mockAudioManager;

    beforeEach(() => {
        window.modals = {};
        mockAudioManager = {
            error: { play: vi.fn() },
            alarm: { play: vi.fn() },
            info: { play: vi.fn() },
            denied: { play: vi.fn() }
        };
        window.audioManager = mockAudioManager;

        let uuidCounter = 0;
        vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
            uuidCounter++;
            return `uuid-${uuidCounter}-aaaa-bbbb-cccc`;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        delete window.modals;
        delete window.audioManager;
    });

    // Import Modal fresh for behavior tests
    async function createModal(options) {
        const { Modal } = await import('../../src/renderer/classes/modal.class.js');
        return new Modal(options);
    }

    it('escapes & in title', async () => {
        await createModal({ type: 'info', title: 'A & B' });
        const h1 = document.querySelector('.modal_popup h1');
        expect(h1.textContent).toBe('A & B');
        expect(h1.innerHTML).toContain('&amp;');
        expect(h1.innerHTML).not.toMatch(/(?<!&\w+);/);
    });

    it('escapes < and > in message', async () => {
        await createModal({ type: 'warning', message: '<script>alert(1)</script>' });
        const h5 = document.querySelector('.modal_popup h5');
        expect(h5.innerHTML).toContain('&lt;');
        expect(h5.innerHTML).toContain('&gt;');
        expect(h5.innerHTML).not.toContain('<script>');
    });

    it('escapes double quotes in title', async () => {
        await createModal({ type: 'info', title: 'Say "hello"' });
        const h1 = document.querySelector('.modal_popup h1');
        // jsdom normalizes entities in innerHTML, so test via textContent
        expect(h1.textContent).toBe('Say "hello"');
    });

    it('escapes single quotes in message', async () => {
        await createModal({ type: 'warning', message: "it's here" });
        const h5 = document.querySelector('.modal_popup h5');
        // jsdom normalizes entities in innerHTML, so test via textContent
        expect(h5.textContent).toBe("it's here");
    });

    it('escapes all five entities in a combined string', async () => {
        await createModal({ type: 'info', title: '&<>"\'' });
        const h1 = document.querySelector('.modal_popup h1');
        expect(h1.textContent).toBe('&<>"\'');
        // Verify none of the raw characters appear in the innerHTML
        expect(h1.innerHTML).not.toMatch(/&(?!amp|lt|gt|quot|#0?39)/);
    });
});
