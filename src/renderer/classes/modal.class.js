// eDEX-UI Modal class (ES module port)
// Original by Gabriel 'Squared' SAILLARD

window.modals = {};

let _focusedId = null;

export const _esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
export class Modal {
    constructor(options, onclose) {
        if (!options || !options.type) throw new Error("Missing parameters");

        this.type = options.type;
        this.id = crypto.randomUUID().slice(0, 8);
        while (typeof window.modals[this.id] !== "undefined") {
            this.id = crypto.randomUUID().slice(0, 8);
        }
        this.title = options.title || options.type || "Modal window";
        this.message = options.message || "Lorem ipsum dolor sit amet.";
        this.onclose = onclose;
        this.classes = "modal_popup";
        this._closed = false;
        this._destroyed = false;
        let buttons = [];
        let augs = [];
        let zindex = 0;

        window.modals[this.id] = {};

        switch(this.type) {
            case "error":
                this.classes += " error";
                zindex = 1500;
                buttons.push({label:"PANIC", action:"close"}, {label:"RELOAD", action:"reload"});
                augs.push("tr-clip", "bl-rect", "r-clip");
                break;
            case "warning":
                this.classes += " warning";
                zindex = 1000;
                buttons.push({label:"OK", action:"close"});
                augs.push("bl-clip", "tr-clip", "r-rect", "b-rect");
                break;
            case "custom":
                this.classes += " info custom";
                zindex = 500;
                buttons = options.buttons || [];
                buttons.push({label:"Close", action:"close"});
                augs.push("tr-clip", "bl-clip");
                break;
            default:
                this.classes += " info";
                zindex = 500;
                buttons.push({label:"OK", action:"close"});
                augs.push("tr-clip", "bl-clip");
                break;
        }

        const titleId = `modal_title_${this.id}`;
        // options.html is escaped by default; pass { rawHtml: true } to skip escaping
        let DOMstring = `<div id="modal_${this.id}" class="${this.classes}" style="z-index:${zindex+Object.keys(window.modals).length};" augmented-ui="${augs.join(" ")} exe" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
            <h1 id="${titleId}">${_esc(this.title)}</h1>
            ${this.type === "custom" ? (options.rawHtml ? options.html : _esc(options.html)) : "<h5>"+_esc(this.message)+"</h5>"}
            <div>`;
            const buttonActions = [];
            buttons.forEach((b, i) => {
                buttonActions.push(b.action);
                DOMstring += `<button data-action-idx="${i}">${_esc(b.label)}</button>`;
            });
        DOMstring += `</div>
        </div>`;

        this.close = () => {
            if (this._closed || this._destroyed) return;
            this._closed = true;
            let modalElement = document.getElementById("modal_"+this.id);
            if (!modalElement) return;
            modalElement.setAttribute("class", "modal_popup "+this.type+" blink");
            if (window.audioManager) window.audioManager.denied.play();
            // Clean up drag listeners if close triggered mid-drag
            window.removeEventListener("mousemove", this._modalMousemoveHandler);
            window.removeEventListener("mouseup", this._modalMouseupHandler);
            window.removeEventListener("touchmove", this._modalTouchmoveHandler);
            window.removeEventListener("touchend", this._modalTouchendHandler);
            setTimeout(() => {
                if (this._destroyed) return;
                modalElement.remove();
                if (window.modals) delete window.modals[this.id];
                document.removeEventListener("keydown", this._escapeKeyHandler);
            }, 100);

            if (typeof this.onclose === "function") {
                this.onclose();
            }
        };

        this.focus = () => {
            let modalElement = document.getElementById("modal_"+this.id);
            if (!modalElement) return;
            modalElement.setAttribute("class", this.classes+" focus");
            _focusedId = this.id;
            Object.keys(window.modals).forEach(id => {
                if (id === this.id) return;
                if (window.modals[id] && window.modals[id].unfocus) window.modals[id].unfocus();
            });
        };

        this.unfocus = () => {
            let modalElement = document.getElementById("modal_"+this.id);
            if (!modalElement) return;
            modalElement.setAttribute("class", this.classes);
            if (_focusedId === this.id) _focusedId = null;
        };

        let tmp = document.createElement("div");
        tmp.innerHTML = DOMstring;
        let element = tmp.firstChild;

        this._mousedownHandler = () => { this.focus(); };
        this._touchstartHandler = () => { this.focus(); };
        element.addEventListener("mousedown", this._mousedownHandler);
        element.addEventListener("touchstart", this._touchstartHandler);

        // Bind button actions via addEventListener using action map
        const actionMap = {
            close: () => this.close(),
            reload: () => window.location.reload(),
            writeFile: (path) => { if (typeof window.writeFile === 'function') window.writeFile(path); },
            writeSettings: () => { if (typeof window.writeSettingsFile === 'function') window.writeSettingsFile(); },
        };
        element.querySelectorAll('button[data-action-idx]').forEach(btn => {
            const idx = parseInt(btn.dataset.actionIdx);
            if (buttonActions[idx]) {
                const action = buttonActions[idx];
                if (typeof action === 'object' && action.name && actionMap[action.name]) {
                    btn.addEventListener('click', () => { actionMap[action.name](action.arg); });
                } else if (typeof action === 'string' && actionMap[action]) {
                    btn.addEventListener('click', () => { actionMap[action](); });
                } else {
                    console.warn('Modal: unknown button action:', action);
                }
            }
        });

        // Escape key handler
        this._escapeKeyHandler = (e) => {
            if (e.key === 'Escape' && _focusedId && window.modals[_focusedId]) {
                window.modals[_focusedId].close();
            }
        };
        document.addEventListener('keydown', this._escapeKeyHandler);

        // Focus trapping
        this._trapFocusHandler = (e) => {
            if (e.key !== 'Tab') return;
            const el = document.getElementById("modal_"+this.id);
            if (!el) return;
            const focusable = el.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"]), a[href]');
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        element.addEventListener('keydown', this._trapFocusHandler);

        if (window.audioManager) {
            switch(this.type) {
                case "error": window.audioManager.error.play(); break;
                case "warning": window.audioManager.alarm.play(); break;
                default: window.audioManager.info.play(); break;
            }
        }

        window.modals[this.id] = this;
        document.body.appendChild(element);
        this.focus();

        // Drag support
        let draggedModal = document.getElementById(`modal_${this.id}`);
        let dragTarget = document.querySelector(`div#modal_${this.id} > h1:first-child`);

        draggedModal.zindex = draggedModal.getAttribute("style");

        setTimeout(() => {
            let rect = draggedModal.getBoundingClientRect();
            draggedModal.posX = rect.left;
            draggedModal.posY = rect.top;
        }, 500);

        let modalMousemoveHandler = function(e) {
            draggedModal.posX = draggedModal.posX + (e.clientX - draggedModal.lastMouseX);
            draggedModal.posY = draggedModal.posY + (e.clientY - draggedModal.lastMouseY);
            draggedModal.lastMouseX = e.clientX;
            draggedModal.lastMouseY = e.clientY;
            draggedModal.setAttribute("style", `${draggedModal.zindex}background: rgba(var(--color_r), var(--color_g), var(--color_b), 0.5);left: ${draggedModal.posX}px;top: ${draggedModal.posY}px;`);
        };
        let modalMouseupHandler = function() {
            window.removeEventListener("mousemove", modalMousemoveHandler);
            draggedModal.setAttribute("style", `${draggedModal.zindex}left: ${draggedModal.posX}px;top: ${draggedModal.posY}px;`);
            window.removeEventListener("mouseup", modalMouseupHandler);
        };
        this._modalMousemoveHandler = modalMousemoveHandler;
        this._modalMouseupHandler = modalMouseupHandler;

        this._dragMousedownHandler = function(e) {
            draggedModal.lastMouseX = e.clientX;
            draggedModal.lastMouseY = e.clientY;
            draggedModal.setAttribute("style", `${draggedModal.zindex}background: rgba(var(--color_r), var(--color_g), var(--color_b), 0.5);left: ${draggedModal.posX}px;top: ${draggedModal.posY}px;`);
            window.addEventListener("mousemove", modalMousemoveHandler);
            window.addEventListener("mouseup", modalMouseupHandler);
        };
        dragTarget.addEventListener("mousedown", this._dragMousedownHandler);

        let modalTouchmoveHandler = function(e) {
            draggedModal.posX = draggedModal.posX + (e.changedTouches[0].clientX - draggedModal.lastMouseX);
            draggedModal.posY = draggedModal.posY + (e.changedTouches[0].clientY - draggedModal.lastMouseY);
            draggedModal.lastMouseX = e.changedTouches[0].clientX;
            draggedModal.lastMouseY = e.changedTouches[0].clientY;
            draggedModal.setAttribute("style", `${draggedModal.zindex}background: rgba(var(--color_r), var(--color_g), var(--color_b), 0.5);left: ${draggedModal.posX}px;top: ${draggedModal.posY}px;`);
        };
        let modalTouchendHandler = function() {
            window.removeEventListener("touchmove", modalTouchmoveHandler);
            draggedModal.setAttribute("style", `${draggedModal.zindex}left: ${draggedModal.posX}px;top: ${draggedModal.posY}px;`);
            window.removeEventListener("touchend", modalTouchendHandler);
        };
        this._modalTouchmoveHandler = modalTouchmoveHandler;
        this._modalTouchendHandler = modalTouchendHandler;

        this._dragTouchstartHandler = function(e) {
            draggedModal.lastMouseX = e.changedTouches[0].clientX;
            draggedModal.lastMouseY = e.changedTouches[0].clientY;
            draggedModal.setAttribute("style", `${draggedModal.zindex}background: rgba(var(--color_r), var(--color_g), var(--color_b), 0.5);left: ${draggedModal.posX}px;top: ${draggedModal.posY}px;`);
            window.addEventListener("touchmove", modalTouchmoveHandler);
            window.addEventListener("touchend", modalTouchendHandler);
        };
        dragTarget.addEventListener("touchstart", this._dragTouchstartHandler);

        return this.id;
    }

    get isVisible() {
        return document.getElementById("modal_"+this.id) !== null;
    }

    get isFocused() {
        return _focusedId === this.id;
    }

    setTitle(newTitle) {
        this.title = newTitle;
        const el = document.getElementById("modal_"+this.id);
        if (!el) return;
        const h1 = el.querySelector('h1');
        if (h1) h1.textContent = newTitle;
    }

    setMessage(newMessage) {
        this.message = newMessage;
        const el = document.getElementById("modal_"+this.id);
        if (!el) return;
        const h5 = el.querySelector('h5');
        if (h5) h5.textContent = newMessage;
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        const el = document.getElementById("modal_"+this.id);
        if (el) {
            el.removeEventListener("mousedown", this._mousedownHandler);
            el.removeEventListener("touchstart", this._touchstartHandler);
            el.removeEventListener("keydown", this._trapFocusHandler);

            // Clean up drag target listeners before removing element
            const dragTarget = el.querySelector('h1');
            if (dragTarget) {
                dragTarget.removeEventListener("mousedown", this._dragMousedownHandler);
                dragTarget.removeEventListener("touchstart", this._dragTouchstartHandler);
            }

            el.remove();
        }

        // Clean up drag listeners
        window.removeEventListener("mousemove", this._modalMousemoveHandler);
        window.removeEventListener("mouseup", this._modalMouseupHandler);
        window.removeEventListener("touchmove", this._modalTouchmoveHandler);
        window.removeEventListener("touchend", this._modalTouchendHandler);


        // Remove escape handler
        document.removeEventListener("keydown", this._escapeKeyHandler);

        // Remove from registry
        delete window.modals[this.id];

        if (_focusedId === this.id) _focusedId = null;
    }
}
