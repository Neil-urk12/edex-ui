import { Terminal as XtermTerminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
// LigaturesAddon removed — requires Node.js APIs (util, fs) unavailable in browser context
import { WebglAddon } from 'xterm-addon-webgl';
import Color from 'color';

class Terminal {
    constructor(opts) {
        if (!opts.parentId || opts.id === undefined) throw new Error("Missing options");

        this.id = opts.id;
        this.cwd = "";
        this.oncwdchange = () => {};

        this.lastSoundFX = Date.now();
        this.lastRefit = Date.now();

        // Support for custom color filters on the terminal - see #483
        let doCustomFilter = (window.isTermFilterValidated) ? true : false;

        // Parse & validate color filter
        if (window.isTermFilterValidated !== true && typeof window.theme.terminal.colorFilter === "object" && window.theme.terminal.colorFilter.length > 0) {
            doCustomFilter = window.theme.terminal.colorFilter.every((step, i, a) => {
                let func = step.slice(0, step.indexOf("("));

                switch(func) {
                    case "negate":
                    case "grayscale":
                        a[i] = {
                            func,
                            arg: []
                        };
                        return true;
                    case "lighten":
                    case "darken":
                    case "saturate":
                    case "desaturate":
                    case "whiten":
                    case "blacken":
                    case "fade":
                    case "opaquer":
                    case "rotate":
                    case "mix":
                        break;
                    default:
                        return false;
                }

                let arg = step.slice(step.indexOf("(")+1, step.indexOf(")"));

                if (typeof Number(arg) === "number") {
                    a[i] = {
                        func,
                        arg: [Number(arg)]
                    };
                    window.isTermFilterValidated = true;
                    return true;
                }

                return false;
            });
        }

        let colorify;
        if (doCustomFilter) {
            colorify = (base, target) => {
                let newColor = Color(base);
                target = Color(target);

                for (let i = 0; i < window.theme.terminal.colorFilter.length; i++) {
                    if (window.theme.terminal.colorFilter[i].func === "mix") {
                        newColor = newColor[window.theme.terminal.colorFilter[i].func](target, ...window.theme.terminal.colorFilter[i].arg);
                    } else {
                        newColor = newColor[window.theme.terminal.colorFilter[i].func](...window.theme.terminal.colorFilter[i].arg);
                    }
                }

                return newColor.hex();
            };
        } else {
            colorify = (base, target) => {
                return Color(base).grayscale().mix(Color(target), 0.3).hex();
            };
        }

        let themeColor = `rgb(${window.theme.r}, ${window.theme.g}, ${window.theme.b})`;

        this.term = new XtermTerminal({
            cols: 80,
            rows: 24,
            cursorBlink: window.theme.terminal.cursorBlink || true,
            cursorStyle: window.theme.terminal.cursorStyle || "block",
            allowTransparency: window.theme.terminal.allowTransparency || false,
            fontFamily: window.theme.terminal.fontFamily || "Fira Mono",
            fontSize: window.theme.terminal.fontSize || window.settings.termFontSize || 15,
            fontWeight: window.theme.terminal.fontWeight || "normal",
            fontWeightBold: window.theme.terminal.fontWeightBold || "bold",
            letterSpacing: window.theme.terminal.letterSpacing || 0,
            lineHeight: window.theme.terminal.lineHeight || 1,
            scrollback: 1500,
            bellStyle: "none",
            theme: {
                foreground: window.theme.terminal.foreground,
                background: window.theme.terminal.background,
                cursor: window.theme.terminal.cursor,
                cursorAccent: window.theme.terminal.cursorAccent,
                selection: window.theme.terminal.selection,
                black: window.theme.colors.black || colorify("#2e3436", themeColor),
                red: window.theme.colors.red || colorify("#cc0000", themeColor),
                green: window.theme.colors.green || colorify("#4e9a06", themeColor),
                yellow: window.theme.colors.yellow || colorify("#c4a000", themeColor),
                blue: window.theme.colors.blue || colorify("#3465a4", themeColor),
                magenta: window.theme.colors.magenta || colorify("#75507b", themeColor),
                cyan: window.theme.colors.cyan || colorify("#06989a", themeColor),
                white: window.theme.colors.white || colorify("#d3d7cf", themeColor),
                brightBlack: window.theme.colors.brightBlack || colorify("#555753", themeColor),
                brightRed: window.theme.colors.brightRed || colorify("#ef2929", themeColor),
                brightGreen: window.theme.colors.brightGreen || colorify("#8ae234", themeColor),
                brightYellow: window.theme.colors.brightYellow || colorify("#fce94f", themeColor),
                brightBlue: window.theme.colors.brightBlue || colorify("#729fcf", themeColor),
                brightMagenta: window.theme.colors.brightMagenta || colorify("#ad7fa8", themeColor),
                brightCyan: window.theme.colors.brightCyan || colorify("#34e2e2", themeColor),
                brightWhite: window.theme.colors.brightWhite || colorify("#eeeeec", themeColor)
            }
        });

        let fitAddon = new FitAddon();
        this.term.loadAddon(fitAddon);
        this.term.open(document.getElementById(opts.parentId));
        this.term.loadAddon(new WebglAddon());
        this.term.attachCustomKeyEventHandler(e => {
            window.keyboard.keydownHandler(e);
            return true;
        });
        // Prevent soft-keyboard on touch devices #733
        document.querySelectorAll('.xterm-helper-textarea').forEach(textarea => textarea.setAttribute('readonly', 'readonly'));
        this.term.focus();
        // Forward user input to PTY
        this.term.onData(data => {
            window.electronAPI.writeTerminal(this.id, data);
        });

        // IPC event listeners
        this._unsubs = [];

        let unsubData = window.electronAPI.onTerminalData((id, data) => {
            if (id !== this.id) return;
            this.term.write(data);

            let d = Date.now();

            if (d - this.lastSoundFX > 30) {
                if (window.passwordMode === "false")
                    window.audioManager.stdout.play();
                this.lastSoundFX = d;
            }
            if (d - this.lastRefit > 10000) {
                this.fit();
            }

            // See #397
            if (!window.settings.experimentalGlobeFeatures) return;
            let ips = data.match(/((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g);
            if (ips !== null && ips.length >= 1) {
                ips = ips.filter((val, index, self) => { return self.indexOf(val) === index; });
                ips.forEach(ip => {
                    window.mods.globe.addTemporaryConnectedMarker(ip);
                });
            }
        });
        if (unsubData) this._unsubs.push(unsubData);

        let unsubExit = window.electronAPI.onTerminalExit((id, _exitCode, _signal) => {
            if (id !== this.id) return;
            if (this.onclose) {
                this.onclose();
            }
        });
        if (unsubExit) this._unsubs.push(unsubExit);

        let unsubCwd = window.electronAPI.onCwdChanged((id, cwd) => {
            if (id === this.id) {
                this.cwd = cwd;
                this.oncwdchange(this.cwd);
            }
        });
        if (unsubCwd) this._unsubs.push(unsubCwd);

        let unsubProcess = window.electronAPI.onProcessChanged((id, process) => {
            if (id === this.id && this.onprocesschange) {
                this.onprocesschange(process);
            }
        });
        if (unsubProcess) this._unsubs.push(unsubProcess);

        // Create the PTY session via IPC
        window.electronAPI.createTerminal({
            id: this.id,
            shell: undefined,
            params: undefined,
            cwd: undefined
        });

        this.resendCWD = () => {
            this.oncwdchange(this.cwd || null);
        };

        // Scroll handling
        let parent = document.getElementById(opts.parentId);
        parent.addEventListener("wheel", e => {
            this.term.scrollLines(Math.round(e.deltaY/10));
        });
        this._lastTouchY = null;
        parent.addEventListener("touchstart", e => {
            this._lastTouchY = e.targetTouches[0].screenY;
        });
        parent.addEventListener("touchmove", e => {
            if (this._lastTouchY) {
                let y = e.changedTouches[0].screenY;
                let deltaY = y - this._lastTouchY;
                this._lastTouchY = y;
                this.term.scrollLines(-Math.round(deltaY/10));
            }
        });
        parent.addEventListener("touchend", () => {
            this._lastTouchY = null;
        });
        parent.addEventListener("touchcancel", () => {
            this._lastTouchY = null;
        });

        document.querySelector(".xterm-helper-textarea").addEventListener("keydown", e => {
            if (e.key === "F11" && window.settings.allowWindowed) {
                e.preventDefault();
                window.toggleFullScreen();
            }
        });

        // Fit logic with screen ratio fixes
        this.fit = () => {
            this.lastRefit = Date.now();
            let {cols, rows} = fitAddon.proposeDimensions();

            // Apply custom fixes based on screen ratio, see #302
            let w = screen.width;
            let h = screen.height;
            let x = 1;
            let y = 0;

            function gcd(a, b) {
                return (b === 0) ? a : gcd(b, a%b);
            }
            let d = gcd(w, h);

            if (d === 100) { y = 1; x = 3;}
            // if (d === 120) y = 1;
            if (d === 256) x = 2;

            if (window.settings.termFontSize < 15) y = y - 1;

            cols = cols+x;
            rows = rows+y;

            if (this.term.cols !== cols || this.term.rows !== rows) {
                this.resize(cols, rows);
            }
        };

        this.resize = (cols, rows) => {
            this.term.resize(cols, rows);
            window.electronAPI.resizeTerminal(this.id, cols, rows);
        };

        this.write = cmd => {
            window.electronAPI.writeTerminal(this.id, cmd);
        };

        this.writelr = cmd => {
            window.electronAPI.writeTerminal(this.id, cmd + "\r");
        };

        this.clipboard = {
            copy: async () => {
                if (!this.term.hasSelection()) return false;
                let text = this.term.getSelection();
                await window.electronAPI.setClipboardText(text);
                this.term.clearSelection();
                this.clipboard.didCopy = true;
            },
            paste: async () => {
                let text = await window.electronAPI.getClipboardText();
                this.write(text);
                this.clipboard.didCopy = false;
            },
            didCopy: false
        };

        // Initial fit
        this.fit();
    }

    destroy() {
        for (let unsub of this._unsubs) {
            if (typeof unsub === 'function') unsub();
        }
        this._unsubs = [];
        this.term.dispose();
    }
}

export { Terminal };
