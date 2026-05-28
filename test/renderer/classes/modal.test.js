// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Modal } from '../../../src/renderer/classes/modal.class.js';
import { escapeHtml } from '../../../src/renderer/utils.js';

describe('Modal', () => {
    let mockAudioManager;

    beforeEach(() => {
        // Reset window.modals
        window.modals = {};

        // Mock audioManager with play() stubs
        mockAudioManager = {
            error: { play: vi.fn() },
            alarm: { play: vi.fn() },
            info: { play: vi.fn() },
            denied: { play: vi.fn() }
        };
        window.audioManager = mockAudioManager;

        // Mock crypto.randomUUID for deterministic IDs
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

    describe('constructor validation', () => {
        it('throws "Missing parameters" when called with no arguments', () => {
            expect(() => new Modal()).toThrow('Missing parameters');
        });

        it('throws "Missing parameters" when options is null', () => {
            expect(() => new Modal(null)).toThrow('Missing parameters');
        });

        it('throws "Missing parameters" when options.type is missing', () => {
            expect(() => new Modal({ title: 'test' })).toThrow('Missing parameters');
        });

        it('throws "Missing parameters" when options.type is empty string', () => {
            expect(() => new Modal({ type: '' })).toThrow('Missing parameters');
        });
    });

    describe('DOM element creation per type', () => {
        it('creates element with class "modal_popup error" for error type', () => {
            new Modal({ type: 'error' });
            const el = document.querySelector('.modal_popup.error');
            expect(el).toBeTruthy();
            expect(el.classList.contains('modal_popup')).toBe(true);
            expect(el.classList.contains('error')).toBe(true);
        });

        it('creates element with class "modal_popup warning" for warning type', () => {
            new Modal({ type: 'warning' });
            const el = document.querySelector('.modal_popup.warning');
            expect(el).toBeTruthy();
            expect(el.classList.contains('warning')).toBe(true);
        });

        it('creates element with class "modal_popup info" for default/info type', () => {
            new Modal({ type: 'info' });
            const el = document.querySelector('.modal_popup.info');
            expect(el).toBeTruthy();
            expect(el.classList.contains('info')).toBe(true);
        });

        it('creates element with class "modal_popup info custom" for custom type', () => {
            new Modal({ type: 'custom', html: '<p>custom</p>' });
            const el = document.querySelector('.modal_popup.custom');
            expect(el).toBeTruthy();
            expect(el.classList.contains('info')).toBe(true);
            expect(el.classList.contains('custom')).toBe(true);
        });

        it('appends the element to document.body', () => {
            new Modal({ type: 'error' });
            const el = document.querySelector('.modal_popup');
            expect(el).toBeTruthy();
            expect(el.parentNode).toBe(document.body);
        });
    });

    describe('z-index', () => {
        it('sets z-index to 1500 (plus modal count) for error type', () => {
            new Modal({ type: 'error' });
            const el = document.querySelector('.modal_popup.error');
            const style = el.getAttribute('style');
            expect(style).toContain('z-index:1501');
        });

        it('sets z-index to 1000 (plus modal count) for warning type', () => {
            new Modal({ type: 'warning' });
            const el = document.querySelector('.modal_popup.warning');
            const style = el.getAttribute('style');
            expect(style).toContain('z-index:1001');
        });

        it('sets z-index to 500 (plus modal count) for default/info type', () => {
            new Modal({ type: 'info' });
            const el = document.querySelector('.modal_popup.info');
            const style = el.getAttribute('style');
            expect(style).toContain('z-index:501');
        });

        it('increments z-index based on number of existing modals', () => {
            new Modal({ type: 'info' });       // base 500 + 1
            new Modal({ type: 'error' });      // base 1500 + 2
            const els = document.querySelectorAll('.modal_popup');
            expect(els[0].getAttribute('style')).toContain('z-index:501');
            expect(els[1].getAttribute('style')).toContain('z-index:1502');
        });
    });

    describe('custom type rendering', () => {
        it('renders options.html instead of message (with rawHtml)', () => {
            new Modal({
                type: 'custom',
                rawHtml: true,
                html: '<div id="custom-content">Hello Custom</div>'
            });
            const customContent = document.getElementById('custom-content');
            expect(customContent).toBeTruthy();
            expect(customContent.textContent).toBe('Hello Custom');
        });

        it('does not render options.html for non-custom types', () => {
            new Modal({
                type: 'error',
                message: 'Test error',
                html: '<div id="should-not-exist">Nope</div>'
            });
            const customContent = document.getElementById('should-not-exist');
            expect(customContent).toBeNull();
        });

        it('renders options.buttons as clickable buttons', () => {
            new Modal({
                type: 'custom',
                html: '<p>content</p>',
                buttons: [{ label: 'Accept', action: 'doAccept()' }]
            });
            const el = document.querySelector('.modal_popup.custom');
            const buttons = el.querySelectorAll('button');
            const labels = Array.from(buttons).map(b => b.textContent);
            expect(labels).toContain('Accept');
            // Close button is always appended for custom type
            expect(labels).toContain('Close');
        });

        it('appends "Close" button automatically for custom type even with no buttons', () => {
            new Modal({
                type: 'custom',
                html: '<p>content</p>'
            });
            const el = document.querySelector('.modal_popup.custom');
            const buttons = el.querySelectorAll('button');
            const labels = Array.from(buttons).map(b => b.textContent);
            expect(labels).toContain('Close');
        });
    });

    describe('title and message', () => {
        it('renders title in h1 element', () => {
            new Modal({ type: 'error', title: 'Critical Failure' });
            const h1 = document.querySelector('.modal_popup h1');
            expect(h1.textContent).toBe('Critical Failure');
        });

        it('falls back to type name as title when title not provided', () => {
            new Modal({ type: 'error' });
            const h1 = document.querySelector('.modal_popup h1');
            expect(h1.textContent).toBe('error');
        });

        it('renders message in h5 element for non-custom types', () => {
            new Modal({ type: 'error', message: 'Something broke' });
            const h5 = document.querySelector('.modal_popup h5');
            expect(h5.textContent).toBe('Something broke');
        });

        it('uses default message when not provided', () => {
            new Modal({ type: 'warning' });
            const h5 = document.querySelector('.modal_popup h5');
            expect(h5.textContent).toBe('Lorem ipsum dolor sit amet.');
        });
    });

    describe('close()', () => {
        it('removes the modal element from DOM after timeout', () => {
            vi.useFakeTimers();
            const modal = new Modal({ type: 'error' });
            const el = document.getElementById(`modal_${modal.id}`);
            expect(el).toBeTruthy();

            modal.close();

            // Element should have blink class immediately
            expect(el.classList.contains('blink')).toBe(true);

            // After 100ms, element should be removed
            vi.advanceTimersByTime(100);
            const elAfter = document.getElementById(`modal_${modal.id}`);
            expect(elAfter).toBeNull();
            vi.useRealTimers();
        });

        it('deletes itself from window.modals', () => {
            vi.useFakeTimers();
            const modal = new Modal({ type: 'warning' });
            expect(window.modals[modal.id]).toBeDefined();

            modal.close();
            vi.advanceTimersByTime(100);

            expect(window.modals[modal.id]).toBeUndefined();
            vi.useRealTimers();
        });

        it('calls the onclose callback', () => {
            const onclose = vi.fn();
            const modal = new Modal({ type: 'info' }, onclose);

            modal.close();

            expect(onclose).toHaveBeenCalledTimes(1);
        });

        it('plays denied audio on close', () => {
            const modal = new Modal({ type: 'error' });
            modal.close();
            expect(mockAudioManager.denied.play).toHaveBeenCalled();
        });

        it('does not throw if element already removed', () => {
            const modal = new Modal({ type: 'error' });
            document.body.innerHTML = '';
            expect(() => modal.close()).not.toThrow();
        });
    });

    describe('focus() and unfocus()', () => {
        it('sets focus class on the modal element', () => {
            const modal = new Modal({ type: 'warning' });
            modal.unfocus(); // reset from constructor auto-focus

            modal.focus();
            const el = document.getElementById(`modal_${modal.id}`);
            expect(el.classList.contains('focus')).toBe(true);
        });

        it('unfocuses other modals when focusing', () => {
            const modal1 = new Modal({ type: 'info' });
            const modal2 = new Modal({ type: 'info' });

            // modal2 was last created so it has focus
            const el1 = document.getElementById(`modal_${modal1.id}`);
            const el2 = document.getElementById(`modal_${modal2.id}`);

            // Focus modal1 - should unfocus modal2
            modal1.focus();

            expect(el1.classList.contains('focus')).toBe(true);
            expect(el2.classList.contains('focus')).toBe(false);
        });

        it('unfocus() removes focus class', () => {
            const modal = new Modal({ type: 'error' });
            const el = document.getElementById(`modal_${modal.id}`);

            // Constructor auto-focuses, so it should have focus
            expect(el.classList.contains('focus')).toBe(true);

            modal.unfocus();
            expect(el.classList.contains('focus')).toBe(false);
        });

        it('focus() is no-op if element already removed from DOM', () => {
            const modal = new Modal({ type: 'error' });
            document.body.innerHTML = '';
            expect(() => modal.focus()).not.toThrow();
        });

        it('unfocus() is no-op if element already removed from DOM', () => {
            const modal = new Modal({ type: 'error' });
            document.body.innerHTML = '';
            expect(() => modal.unfocus()).not.toThrow();
        });
    });

    describe('audio playback', () => {
        it('plays error audio for error type', () => {
            new Modal({ type: 'error' });
            expect(mockAudioManager.error.play).toHaveBeenCalledTimes(1);
            expect(mockAudioManager.alarm.play).not.toHaveBeenCalled();
            expect(mockAudioManager.info.play).not.toHaveBeenCalled();
        });

        it('plays alarm audio for warning type', () => {
            new Modal({ type: 'warning' });
            expect(mockAudioManager.alarm.play).toHaveBeenCalledTimes(1);
            expect(mockAudioManager.error.play).not.toHaveBeenCalled();
            expect(mockAudioManager.info.play).not.toHaveBeenCalled();
        });

        it('plays info audio for default/info type', () => {
            new Modal({ type: 'info' });
            expect(mockAudioManager.info.play).toHaveBeenCalledTimes(1);
            expect(mockAudioManager.error.play).not.toHaveBeenCalled();
            expect(mockAudioManager.alarm.play).not.toHaveBeenCalled();
        });

        it('plays info audio for custom type (falls to default case)', () => {
            new Modal({ type: 'custom', html: '<p>test</p>' });
            expect(mockAudioManager.info.play).toHaveBeenCalledTimes(1);
        });

        it('does not throw when audioManager is not defined', () => {
            delete window.audioManager;
            expect(() => new Modal({ type: 'error' })).not.toThrow();
        });
    });

    describe('window.modals registry', () => {
        it('stores the modal instance in window.modals by id', () => {
            const modal = new Modal({ type: 'error' });
            expect(window.modals[modal.id]).toBe(modal);
        });

        it('assigns unique ids to each modal', () => {
            const modal1 = new Modal({ type: 'info' });
            const modal2 = new Modal({ type: 'warning' });
            expect(modal1.id).not.toBe(modal2.id);
        });

        it('multiple modals coexist in window.modals', () => {
            const modal1 = new Modal({ type: 'error' });
            const modal2 = new Modal({ type: 'warning' });
            const modal3 = new Modal({ type: 'info' });

            expect(Object.keys(window.modals)).toHaveLength(3);
            expect(window.modals[modal1.id]).toBe(modal1);
            expect(window.modals[modal2.id]).toBe(modal2);
            expect(window.modals[modal3.id]).toBe(modal3);
        });

        it('close() removes only the closed modal from window.modals', () => {
            vi.useFakeTimers();
            const modal1 = new Modal({ type: 'error' });
            const modal2 = new Modal({ type: 'warning' });

            modal1.close();
            vi.advanceTimersByTime(100);

            expect(window.modals[modal1.id]).toBeUndefined();
            expect(window.modals[modal2.id]).toBe(modal2);
            vi.useRealTimers();
        });
    });

    describe('constructor return value', () => {
        it('returns the modal id', () => {
            const result = new Modal({ type: 'error' });
            // Constructor returns this.id (unusual pattern)
            expect(typeof result.id).toBe('string');
            expect(result.id.length).toBeGreaterThan(0);
        });
    });

    describe('augmented-ui attributes', () => {
        it('sets augmented-ui attribute with error-specific augmentations', () => {
            new Modal({ type: 'error' });
            const el = document.querySelector('.modal_popup.error');
            const aug = el.getAttribute('augmented-ui');
            expect(aug).toContain('tr-clip');
            expect(aug).toContain('bl-rect');
            expect(aug).toContain('r-clip');
        });

        it('sets augmented-ui attribute with warning-specific augmentations', () => {
            new Modal({ type: 'warning' });
            const el = document.querySelector('.modal_popup.warning');
            const aug = el.getAttribute('augmented-ui');
            expect(aug).toContain('bl-clip');
            expect(aug).toContain('tr-clip');
            expect(aug).toContain('r-rect');
            expect(aug).toContain('b-rect');
        });

        it('sets augmented-ui attribute with info/default augmentations', () => {
            new Modal({ type: 'info' });
            const el = document.querySelector('.modal_popup.info');
            const aug = el.getAttribute('augmented-ui');
            expect(aug).toContain('tr-clip');
            expect(aug).toContain('bl-clip');
        });

    // ============================================================
    // RED phase: tests for behaviors the Modal class SHOULD have
    // but DOES NOT yet implement. These tests WILL FAIL.
    // ============================================================
    describe('[RED] accessibility (ARIA attributes)', () => {
        it('sets role="dialog" on the modal element', () => {
            const modal = new Modal({ type: 'error' });
            const el = document.getElementById(`modal_${modal.id}`);
            expect(el.getAttribute('role')).toBe('dialog');
        });

        it('sets aria-modal="true" on the modal element', () => {
            const modal = new Modal({ type: 'warning' });
            const el = document.getElementById(`modal_${modal.id}`);
            expect(el.getAttribute('aria-modal')).toBe('true');
        });

        it('sets aria-labelledby pointing to the h1 title', () => {
            const modal = new Modal({ type: 'info', title: 'Test Title' });
            const el = document.getElementById(`modal_${modal.id}`);
            const labelledBy = el.getAttribute('aria-labelledby');
            expect(labelledBy).toBeTruthy();
            const titleEl = document.getElementById(labelledBy);
            expect(titleEl).toBeTruthy();
            expect(titleEl.textContent).toBe('Test Title');
        });
    });

    describe('[RED] Escape key close', () => {
        it('closes the topmost modal when Escape is pressed', () => {
            vi.useFakeTimers();
            const modal = new Modal({ type: 'error' });

            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(event);

            vi.advanceTimersByTime(100);
            expect(document.getElementById(`modal_${modal.id}`)).toBeNull();
            vi.useRealTimers();
        });

        it('only closes the focused modal, not others', () => {
            vi.useFakeTimers();
            const modal1 = new Modal({ type: 'info' });
            const modal2 = new Modal({ type: 'warning' });
            // modal2 is focused (last created)

            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(event);

            vi.advanceTimersByTime(100);
            expect(document.getElementById(`modal_${modal1.id}`)).toBeTruthy();
            expect(document.getElementById(`modal_${modal2.id}`)).toBeNull();
            vi.useRealTimers();
        });
    });

    describe('[RED] close() idempotency', () => {
        it('fires onclose callback only once when close() is called twice', () => {
            const onclose = vi.fn();
            const modal = new Modal({ type: 'error' }, onclose);

            modal.close();
            modal.close();

            expect(onclose).toHaveBeenCalledTimes(1);
        });

        it('plays denied audio only once when close() is called twice', () => {
            const modal = new Modal({ type: 'error' });

            modal.close();
            modal.close();

            expect(mockAudioManager.denied.play).toHaveBeenCalledTimes(1);
        });
    });

    describe('[RED] destroy() method', () => {
        it('removes mousedown listener from the modal element', () => {
            const modal = new Modal({ type: 'error' });
            const el = document.getElementById(`modal_${modal.id}`);
            // Spy BEFORE destroy so we capture the removeEventListener calls
            const removeSpy = vi.spyOn(el, 'removeEventListener');
            modal.destroy();
            // Verify listeners were cleaned up
            expect(removeSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        });

        it('removes modal from DOM and window.modals', () => {
            const modal = new Modal({ type: 'warning' });
            modal.destroy();

            expect(document.getElementById(`modal_${modal.id}`)).toBeNull();
            expect(window.modals[modal.id]).toBeUndefined();
        });

        it('cleans up drag-related window event listeners', () => {
            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
            const modal = new Modal({ type: 'info' });

            modal.destroy();

            // Should remove any lingering drag listeners
            const removedEvents = removeEventListenerSpy.mock.calls.map(c => c[0]);
            expect(removedEvents).toContain('mousemove');
            expect(removedEvents).toContain('mouseup');
            expect(removedEvents).toContain('touchmove');
            expect(removedEvents).toContain('touchend');
        });

        it('is safe to call multiple times', () => {
            const modal = new Modal({ type: 'error' });
            modal.destroy();
            expect(() => modal.destroy()).not.toThrow();
        });
    });

    describe('[RED] focus trapping', () => {
        it('traps Tab key within the modal buttons', () => {
            const modal = new Modal({
                type: 'error'
            });
            const el = document.getElementById(`modal_${modal.id}`);
            const buttons = el.querySelectorAll('button');
            const lastButton = buttons[buttons.length - 1];

            // Focus the last button, then Tab should cycle to first
            lastButton.focus();
            const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
            lastButton.dispatchEvent(tabEvent);

            expect(document.activeElement).toBe(buttons[0]);
        });

        it('traps Shift+Tab to cycle backwards to last button', () => {
            const modal = new Modal({
                type: 'error'
            });
            const el = document.getElementById(`modal_${modal.id}`);
            const buttons = el.querySelectorAll('button');
            const firstButton = buttons[0];

            firstButton.focus();
            const tabEvent = new KeyboardEvent('keydown', {
                key: 'Tab',
                shiftKey: true,
                bubbles: true
            });
            firstButton.dispatchEvent(tabEvent);

            expect(document.activeElement).toBe(buttons[buttons.length - 1]);
        });
    });

    describe('[RED] isVisible property', () => {
        it('is true when modal is in the DOM', () => {
            const modal = new Modal({ type: 'error' });
            expect(modal.isVisible).toBe(true);
        });

        it('is false after modal is closed and removed', () => {
            vi.useFakeTimers();
            const modal = new Modal({ type: 'error' });
            modal.close();
            vi.advanceTimersByTime(100);
            expect(modal.isVisible).toBe(false);
            vi.useRealTimers();
        });
    });

    describe('[RED] isFocused property', () => {
        it('is true for the last created modal', () => {
            const modal1 = new Modal({ type: 'info' });
            const modal2 = new Modal({ type: 'warning' });
            expect(modal2.isFocused).toBe(true);
        });

        it('is false after another modal is focused', () => {
            const modal1 = new Modal({ type: 'info' });
            const modal2 = new Modal({ type: 'warning' });
            modal1.focus();
            expect(modal2.isFocused).toBe(false);
        });
    });

    describe('[RED] update content methods', () => {
        it('setTitle() updates the h1 text', () => {
            const modal = new Modal({ type: 'info', title: 'Original' });
            modal.setTitle('Updated Title');
            const h1 = document.querySelector(`#modal_${modal.id} h1`);
            expect(h1.textContent).toBe('Updated Title');
        });

        it('setMessage() updates the h5 text for non-custom types', () => {
            const modal = new Modal({ type: 'warning', message: 'Original msg' });
            modal.setMessage('New message');
            const h5 = document.querySelector(`#modal_${modal.id} h5`);
            expect(h5.textContent).toBe('New message');
        });

        it('setTitle() updates this.title', () => {
            const modal = new Modal({ type: 'error', title: 'Old' });
            modal.setTitle('New');
            expect(modal.title).toBe('New');
        });
    });

    describe('[RED] Bug: escape handler leaks on close()', () => {
        it('removes escape keydown listener from document when close() is called', () => {
            vi.useFakeTimers();
            const removeDocSpy = vi.spyOn(document, 'removeEventListener');
            const modal = new Modal({ type: 'error' });

            modal.close();
            vi.advanceTimersByTime(100);

            expect(removeDocSpy).toHaveBeenCalledWith('keydown', modal._escapeKeyHandler);
            vi.useRealTimers();
        });
    });

    describe('[RED] Bug: drag listeners not cleaned up on dragTarget in destroy()', () => {
        it('removes mousedown and touchstart from dragTarget h1 on destroy()', () => {
            const modal = new Modal({ type: 'error' });
            const h1 = document.querySelector(`#modal_${modal.id} > h1`);
            const h1RemoveSpy = vi.spyOn(h1, 'removeEventListener');

            modal.destroy();

            expect(h1RemoveSpy).toHaveBeenCalledWith('mousedown', modal._dragMousedownHandler);
            expect(h1RemoveSpy).toHaveBeenCalledWith('touchstart', modal._dragTouchstartHandler);
        });
    });

    describe('[RED] XSS prevention in title and message', () => {
        it('does not interpret HTML tags in title - stores as text', () => {
            const xssPayload = '<img src=x onerror=alert(1)>';
            const modal = new Modal({ type: 'error', title: xssPayload });
            const h1 = document.querySelector(`#modal_${modal.id} h1`);
            // textContent returns raw text, innerHTML would contain the tag if unescaped
            expect(h1.textContent).toBe(xssPayload);
            // The critical check: innerHTML must NOT contain a live <img> tag
            expect(h1.innerHTML).not.toContain('<img');
            expect(h1.innerHTML).toContain('&lt;img');
        });

        it('does not interpret HTML tags in message - stores as text', () => {
            const xssPayload = '<script>alert("xss")</script>';
            const modal = new Modal({ type: 'warning', message: xssPayload });
            const h5 = document.querySelector(`#modal_${modal.id} h5`);
            expect(h5.textContent).toBe(xssPayload);
            expect(h5.innerHTML).not.toContain('<script');
            expect(h5.innerHTML).toContain('&lt;script');
        });

        it('escapes double quotes in title to prevent attribute injection', () => {
            const xssPayload = '" onmouseover="alert(1)';
            const modal = new Modal({ type: 'info', title: xssPayload });
            const h1 = document.querySelector(`#modal_${modal.id} h1`);
            expect(h1.textContent).toBe(xssPayload);
            // Verify no injected elements exist (the " stays in text, not attributes)
            expect(h1.querySelector('*')).toBeNull();
        });

        it('escapes ampersands in title', () => {
            const modal = new Modal({ type: 'info', title: 'A & B' });
            const h1 = document.querySelector(`#modal_${modal.id} h1`);
            expect(h1.textContent).toBe('A & B');
            expect(h1.innerHTML).toContain('&amp;');
        });

        it('escapes HTML in message for error type too', () => {
            const xssPayload = '<b onmouseover=alert(1)>bold</b>';
            const modal = new Modal({ type: 'error', message: xssPayload });
            const h5 = document.querySelector(`#modal_${modal.id} h5`);
            expect(h5.textContent).toBe(xssPayload);
            expect(h5.innerHTML).not.toContain('<b ');
        });
    });

    describe('XSS prevention in button labels', () => {
        it('escapes HTML tags in custom button label', () => {
            const xssPayload = '<img src=x onerror=alert(1)>';
            new Modal({
                type: 'custom',
                html: '<p>content</p>',
                buttons: [{ label: xssPayload, action: 'void(0)' }]
            });
            const el = document.querySelector('.modal_popup.custom');
            const buttons = el.querySelectorAll('button');
            const btn = Array.from(buttons).find(b => b.textContent === xssPayload);
            expect(btn).toBeTruthy();
            // innerHTML must NOT contain a live <img> tag
            expect(btn.innerHTML).not.toContain('<img');
            expect(btn.innerHTML).toContain('&lt;img');
        });

        it('escapes double quotes in button label to prevent attribute injection', () => {
            const xssPayload = '" onclick="alert(1)';
            new Modal({
                type: 'custom',
                html: '<p>content</p>',
                buttons: [{ label: xssPayload, action: 'void(0)' }]
            });
            const el = document.querySelector('.modal_popup.custom');
            const buttons = el.querySelectorAll('button');
            const btn = Array.from(buttons).find(b => b.textContent === xssPayload);
            expect(btn).toBeTruthy();
            // button uses data-action-idx, not onclick (XSS-safe)
            expect(btn.getAttribute('onclick')).toBeNull();
            expect(btn.hasAttribute('data-action-idx')).toBe(true);
        });

        it('leaves safe button labels unchanged', () => {
            new Modal({
                type: 'custom',
                html: '<p>content</p>',
                buttons: [{ label: 'Accept', action: 'void(0)' }]
            });
            const el = document.querySelector('.modal_popup.custom');
            const buttons = el.querySelectorAll('button');
            const labels = Array.from(buttons).map(b => b.textContent);
            expect(labels).toContain('Accept');
            expect(labels).toContain('Close');
        });
    });

    describe('XSS prevention in button action attributes', () => {
        it('does not use inline onclick attributes (XSS-safe)', () => {
            new Modal({
                type: 'custom',
                html: '<p>test</p>',
                buttons: [{ label: 'Click', action: 'alert(1)' }]
            });
            const button = document.querySelector('.modal_popup button');
            // No onclick attribute — actions bound via addEventListener
            expect(button.getAttribute('onclick')).toBeNull();
            expect(button.hasAttribute('data-action-idx')).toBe(true);
        });

        it('button action strings cannot break out via HTML entity decoding', () => {
            new Modal({
                type: 'custom',
                html: '<p>test</p>',
                buttons: [{ label: 'Click', action: '" onmouseover="alert(1)' }]
            });
            const button = document.querySelector('.modal_popup button');
            const rawHtml = button.outerHTML;
            // No onclick attribute at all — safe
            expect(rawHtml).not.toContain('onclick');
            expect(rawHtml).toContain('data-action-idx');
        });
    });

    describe('XSS prevention at custom modal call sites', () => {
        it('escapes HTML entities in error messages passed as custom html', () => {
            // Simulates filesystem.class.js: html: String(err)
            // After fix: html: _escapeHtml(String(err))
            const err = new Error('File not found: <img src=x onerror=alert(1)>');
            const escaped = escapeHtml(String(err));
            expect(escaped).not.toContain('<img');
            expect(escaped).toContain('&lt;img');
        });

        it('escapes HTML in textarea content to prevent breakout', () => {
            // Simulates filesystem.class.js: ${data} in textarea
            // After fix: ${_escapeHtml(data)}
            const fileContent = '</textarea><img src=x onerror=alert(1)>';
            const html = `<textarea>${escapeHtml(fileContent)}</textarea>`;
            expect(html).not.toContain('</textarea><img');
            expect(html).toContain('&lt;/textarea&gt;');
        });

        it('escapes quotes in settings values to prevent attribute breakout', () => {
            // Simulates main.js: value="${window.settings.shell}"
            // After fix: value="${escapeHtml(window.settings.shell)}"
            const maliciousSetting = '" onfocus="alert(1)';
            const html = `<input value="${escapeHtml(maliciousSetting)}">`;
            expect(html).not.toContain('" onfocus="');
            expect(html).toContain('&quot; onfocus=');
        });
    });
});

describe('Button actions use action map instead of new Function', () => {
    it('error modal PANIC button closes modal without eval', () => {
        const modal = new Modal({ type: 'error' });
        const el = document.getElementById('modal_' + modal.id);
        const panicBtn = Array.from(el.querySelectorAll('button')).find(b => b.textContent === 'PANIC');
        expect(panicBtn).toBeTruthy();
        panicBtn.click();
        expect(el.className).toContain('blink');
    });

    it('custom modal button closes modal via action map', () => {
        const modal = new Modal({
            type: 'custom',
            html: '<p>test</p>',
            buttons: [{ label: 'Do Thing', action: "close" }]
        });
        const el = document.getElementById('modal_' + modal.id);
        const btn = Array.from(el.querySelectorAll('button')).find(b => b.textContent === 'Do Thing');
        expect(btn).toBeTruthy();
        btn.click();
        expect(el.className).toContain('blink');
    });

    it('uses action map keys, not code strings', () => {
        // Verify that built-in buttons use named actions
        const modal = new Modal({ type: 'error' });
        const el = document.getElementById('modal_' + modal.id);
        const buttons = Array.from(el.querySelectorAll('button'));
        // PANIC and RELOAD buttons should exist and work via action map
        const panicBtn = buttons.find(b => b.textContent === 'PANIC');
        const reloadBtn = buttons.find(b => b.textContent === 'RELOAD');
        expect(panicBtn).toBeTruthy();
        expect(reloadBtn).toBeTruthy();
        // PANIC should close via action map
        panicBtn.click();
        expect(el.className).toContain('blink');
});

describe('Custom modal HTML sanitization', () => {
    it('escapes HTML tags in options.html to prevent XSS', () => {
        const modal = new Modal({
            type: 'custom',
            html: '<img src=x onerror="window.xssTriggered=true">'
        });
        const el = document.getElementById('modal_' + modal.id);
        // After fix, raw HTML should be escaped. Currently rendered raw — test should FAIL.
        expect(el.innerHTML).not.toContain('<img');
        expect(el.innerHTML).toContain('&lt;img');
    });

    it('allows safe HTML in options.html when rawHtml is true', () => {
        const modal = new Modal({
            type: 'custom',
            html: '<p class="safe">Hello</p>',
            rawHtml: true
        });
        const el = document.getElementById('modal_' + modal.id);
        expect(el.querySelector('p.safe')).toBeTruthy();
    });
});
});
