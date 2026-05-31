// eDEX-UI Sysinfo Module (ported to ES module - uses IPC for system info)
import { POLL_INTERVALS } from '../constants.js';
export class Sysinfo {
    constructor(parentId) {
        if (!parentId) throw new Error("Missing parameters");

        const os = navigator.platform.includes('Mac') ? 'macOS' :
                   navigator.platform.includes('Win') ? 'Windows' :
                   navigator.platform.includes('Linux') ? 'Linux' : navigator.platform;

        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_sysinfo">
            <div>
                <h1>1970</h1>
                <h2>JAN 1</h2>
            </div>
            <div>
                <h1>UPTIME</h1>
                <h2>0:0:0</h2>
            </div>
            <div>
                <h1>TYPE</h1>
                <h2>${os}</h2>
            </div>
            <div>
                <h1>POWER</h1>
                <h2>00%</h2>
            </div>
        </div>`;

        this._els = {
            year: this.parent.querySelector('#mod_sysinfo > div:first-child > h1'),
            date: this.parent.querySelector('#mod_sysinfo > div:first-child > h2'),
            uptime: this.parent.querySelector('#mod_sysinfo > div:nth-child(2) > h2'),
            battery: this.parent.querySelector('#mod_sysinfo > div:nth-child(4) > h2'),
        };

        this.updateDate();
        this.updateUptime();
        this.uptimeUpdater = setInterval(() => {
            this.updateUptime();
        }, POLL_INTERVALS.UPTIME);
        this.updateBattery();
        this.batteryUpdater = setInterval(() => {
            this.updateBattery();
        }, POLL_INTERVALS.BATTERY);
    }

    updateDate() {
        let time = new Date();
        if (this._els.year) this._els.year.innerText = time.getFullYear();

        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        if (this._els.date) this._els.date.innerText = months[time.getMonth()] + ' ' + time.getDate();
    }

    updateUptime() {
        if (window.electronAPI && window.electronAPI.getSystemUptime) {
            window.electronAPI.getSystemUptime().then(uptime => {
                let h = Math.floor(uptime / 3600);
                let m = Math.floor((uptime % 3600) / 60);
                if (this._els.uptime) this._els.uptime.innerText = `${h}:${m}`;
            }).catch(() => {
                // Silently handle IPC failures — keep default display
            });
        } else {
            // Fallback: use performance API
            let sec = Math.floor(performance.now() / 1000);
            let h = Math.floor(sec / 3600);
            let m = Math.floor((sec % 3600) / 60);
            if (this._els.uptime) this._els.uptime.innerText = `${h}:${m}`;
        }
    }

    async updateBattery() {
        try {
            if ('getBattery' in navigator) {
                const battery = await navigator.getBattery();
                const level = Math.round(battery.level * 100);
                const charging = battery.charging;
                if (this._els.battery) this._els.battery.innerText =
                    `${level.toString().padStart(2, '0')}%` + (charging ? ' ⚡' : '');
            } else {
                if (this._els.battery) this._els.battery.innerText = 'N/A';
            }
        } catch {
            if (this._els.battery) this._els.battery.innerText = 'N/A';
        }
    }

    dispose() {
        clearInterval(this.uptimeUpdater);
        clearInterval(this.batteryUpdater);
    }
}
