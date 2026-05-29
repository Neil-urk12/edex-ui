// eDEX-UI Sysinfo Module (ported to ES module - uses IPC for system info)
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

        this.updateDate();
        this.updateUptime();
        this.uptimeUpdater = setInterval(() => {
            this.updateUptime();
        }, 60000);
        this.updateBattery();
        this.batteryUpdater = setInterval(() => {
            this.updateBattery();
        }, 3000);
    }

    updateDate() {
        let time = new Date();
        document.querySelector("#mod_sysinfo > div:first-child > h1").innerHTML = time.getFullYear();

        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        document.querySelector("#mod_sysinfo > div:first-child > h2").innerHTML = months[time.getMonth()] + " " + time.getDate();
    }

    updateUptime() {
        if (window.electronAPI && window.electronAPI.getSystemUptime) {
            window.electronAPI.getSystemUptime().then(uptime => {
                let h = Math.floor(uptime / 3600);
                let m = Math.floor((uptime % 3600) / 60);
                document.querySelector("#mod_sysinfo > div:nth-child(2) > h2").innerHTML = `${h}:${m}`;
            }).catch(() => {
                // Silently handle IPC failures — keep default display
            });
        } else {
            // Fallback: use performance API
            let sec = Math.floor(performance.now() / 1000);
            let h = Math.floor(sec / 3600);
            let m = Math.floor((sec % 3600) / 60);
            document.querySelector("#mod_sysinfo > div:nth-child(2) > h2").innerHTML = `${h}:${m}`;
        }
    }

    async updateBattery() {
        try {
            if ('getBattery' in navigator) {
                const battery = await navigator.getBattery();
                const level = Math.round(battery.level * 100);
                const charging = battery.charging;
                document.querySelector("#mod_sysinfo > div:nth-child(4) > h2").innerHTML =
                    `${level.toString().padStart(2, '0')}%` + (charging ? " ⚡" : "");
            } else {
                document.querySelector("#mod_sysinfo > div:nth-child(4) > h2").innerHTML = "N/A";
            }
        } catch {
            document.querySelector("#mod_sysinfo > div:nth-child(4) > h2").innerHTML = "N/A";
        }
    }

    dispose() {
        clearInterval(this.uptimeUpdater);
        clearInterval(this.batteryUpdater);
    }
}
