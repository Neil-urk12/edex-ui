// eDEX-UI Cpuinfo Module
export class Cpuinfo {
    constructor(parentId) {
        if (!parentId) throw new Error("Missing parameters");

        this.parent = document.getElementById(parentId);
        this.container = document.createElement("div");
        this.container.setAttribute("id", "mod_cpuinfo");

        // Build DOM and start polling after CPU info resolves
        window.electronAPI.getCpuInfo().then(data => {
            const halfCores = Math.floor(data.cores / 2);
            const cpuName = data.manufacturer + ' ' + data.brand;

            this.container.innerHTML = `<div id="mod_cpuinfo_innercontainer">
                <h1>CPU USAGE<i id="mod_cpuinfo_cputitle"></i></h1>
                <div>
                    <h1># <em>1</em> - <em>${halfCores}</em><br>
                    <i id="mod_cpuinfo_usagecounter0">Avg. --%</i></h1>
                </div>
                <div>
                    <h1># <em>${halfCores + 1}</em> - <em>${data.cores}</em><br>
                    <i id="mod_cpuinfo_usagecounter1">Avg. --%</i></h1>
                </div>
                <div>
                    <h1>CORES<br>
                    <i id="mod_cpuinfo_temp">--</i></h1>
                </div>
                <div>
                    <h1>SPD<br>
                    <i id="mod_cpuinfo_speed_min">--GHz</i></h1>
                </div>
                <div>
                    <h1>MAX<br>
                    <i id="mod_cpuinfo_speed_max">--GHz</i></h1>
                </div>
                <div>
                    <h1>TASKS<br>
                    <i id="mod_cpuinfo_tasks">---</i></h1>
                </div>
            </div>`;
            this.container.querySelector('#mod_cpuinfo_cputitle').textContent = cpuName;

            // Start polling intervals after DOM is built
            this.loadUpdater = setInterval(() => { this.updateCPUload(); }, 500);
            this.tempUpdater = setInterval(() => { this.updateCPUtemp(); }, 2000);
            this.speedUpdater = setInterval(() => { this.updateCPUspeed(); }, 1000);
            this.tasksUpdater = setInterval(() => { this.updateCPUtasks(); }, 5000);
                this.currentlyUpdating = false;
                this.updatingCPUspeed = false;
                this.updatingCPUtasks = false;
        }).catch(err => console.warn('[Cpuinfo] init failed:', err));

        this.parent.append(this.container);

        // Guard flags
        this.currentlyUpdating = true;
        this.updatingCPUspeed = true;
        this.updatingCPUtasks = true;
    }

    updateCPUload() {
        if (this.currentlyUpdating) return;
        this.currentlyUpdating = true;
        window.electronAPI.getCpuLoad().then(data => {
            const half = Math.floor(data.cpus.length / 2);
            const firstHalf = data.cpus.slice(0, half);
            const secondHalf = data.cpus.slice(half);
            const avg0 = firstHalf.length > 0 ? Math.round(firstHalf.reduce((sum, c) => sum + c.load, 0) / firstHalf.length) : 0;
            const avg1 = secondHalf.length > 0 ? Math.round(secondHalf.reduce((sum, c) => sum + c.load, 0) / secondHalf.length) : 0;
            document.getElementById("mod_cpuinfo_usagecounter0").innerText = `Avg. ${avg0}%`;
            document.getElementById("mod_cpuinfo_usagecounter1").innerText = `Avg. ${avg1}%`;
            this.currentlyUpdating = false;
        }).catch((err) => {
            console.warn('[Cpuinfo] getCpuLoad failed:', err);
            this.currentlyUpdating = false;
        });
    }

    updateCPUtemp() {
        window.electronAPI.getCpuTemperature().then(data => {
            document.getElementById("mod_cpuinfo_temp").innerText = `${data.max}°C`;
        }).catch((err) => console.warn('[Cpuinfo] getCpuTemperature failed:', err));
    }

    updateCPUspeed() {
        if (this.updatingCPUspeed) return;
        this.updatingCPUspeed = true;
        window.electronAPI.getCpuInfo().then(data => {
            document.getElementById("mod_cpuinfo_speed_min").innerText = `${data.speed}GHz`;
            document.getElementById("mod_cpuinfo_speed_max").innerText = `${data.speedMax}GHz`;
            this.updatingCPUspeed = false;
        }).catch((err) => {
            console.warn('[Cpuinfo] getCpuInfo failed:', err);
            this.updatingCPUspeed = false;
        });
    }

    updateCPUtasks() {
        if (this.updatingCPUtasks) return;
        this.updatingCPUtasks = true;
        window.electronAPI.getProcesses().then(data => {
            document.getElementById("mod_cpuinfo_tasks").innerText = `${data.all}`;
            this.updatingCPUtasks = false;
        }).catch((err) => {
            console.warn('[Cpuinfo] getProcesses failed:', err);
            this.updatingCPUtasks = false;
        });
    }

    cleanup() {
        clearInterval(this.loadUpdater);
        clearInterval(this.tempUpdater);
        clearInterval(this.speedUpdater);
        clearInterval(this.tasksUpdater);
    }
}
