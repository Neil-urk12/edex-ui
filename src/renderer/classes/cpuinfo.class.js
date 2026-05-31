// eDEX-UI Cpuinfo Module
import { POLL_INTERVALS } from '../constants.js';
import { guardedPoll } from '../utils/poll-guard.js';
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

			this._els = {
				usageCounter0: document.getElementById('mod_cpuinfo_usagecounter0'),
				usageCounter1: document.getElementById('mod_cpuinfo_usagecounter1'),
				temp: document.getElementById('mod_cpuinfo_temp'),
				speedMin: document.getElementById('mod_cpuinfo_speed_min'),
				speedMax: document.getElementById('mod_cpuinfo_speed_max'),
				tasks: document.getElementById('mod_cpuinfo_tasks'),
			};

            // Start polling intervals after DOM is built
            this.loadUpdater = setInterval(() => { this.updateCPUload(); }, POLL_INTERVALS.CPU_LOAD);
            this.tempUpdater = setInterval(() => { this.updateCPUtemp(); }, POLL_INTERVALS.CPU_TEMP);
            this.speedUpdater = setInterval(() => { this.updateCPUspeed(); }, POLL_INTERVALS.CPU_SPEED);
            this.tasksUpdater = setInterval(() => { this.updateCPUtasks(); }, POLL_INTERVALS.CPU_TASKS);
            this._resetGuardFlags();
        }).catch(err => { console.warn('[Cpuinfo] init failed:', err); this._resetGuardFlags(); });

        this.parent.append(this.container);

        // Guard flags
        this.currentlyUpdating = true;
        this.updatingCPUspeed = true;
        this.updatingCPUtasks = true;
        this.updatingCPUtemp = true;
    }

	updateCPUload() {
		guardedPoll(this, 'currentlyUpdating',
			() => window.electronAPI.getCpuLoad(),
			data => {
				const half = Math.floor(data.cpus.length / 2);
				const firstHalf = data.cpus.slice(0, half);
				const secondHalf = data.cpus.slice(half);
				const avg0 = firstHalf.length > 0 ? Math.round(firstHalf.reduce((sum, c) => sum + c.load, 0) / firstHalf.length) : 0;
				const avg1 = secondHalf.length > 0 ? Math.round(secondHalf.reduce((sum, c) => sum + c.load, 0) / secondHalf.length) : 0;
				if (this._els.usageCounter0) this._els.usageCounter0.innerText = `Avg. ${avg0}%`;
				if (this._els.usageCounter1) this._els.usageCounter1.innerText = `Avg. ${avg1}%`;
			}
		);
	}

	updateCPUtemp() {
		guardedPoll(this, 'updatingCPUtemp',
			() => window.electronAPI.getCpuTemperature(),
			data => {
				if (this._els.temp) this._els.temp.innerText = `${data.max}°C`;
			}
		);
	}

	updateCPUspeed() {
		guardedPoll(this, 'updatingCPUspeed',
			() => window.electronAPI.getCpuInfo(),
			data => {
				if (this._els.speedMin) this._els.speedMin.innerText = `${data.speed}GHz`;
				if (this._els.speedMax) this._els.speedMax.innerText = `${data.speedMax}GHz`;
			}
		);
	}

	updateCPUtasks() {
		guardedPoll(this, 'updatingCPUtasks',
			() => window.electronAPI.getProcesses(),
			data => {
				if (this._els.tasks) this._els.tasks.innerText = `${data.all}`;
			}
		);
	}

    _resetGuardFlags() {
        this.currentlyUpdating = false;
        this.updatingCPUspeed = false;
        this.updatingCPUtasks = false;
        this.updatingCPUtemp = false;
    }

    dispose() {
        this._resetGuardFlags();
        clearInterval(this.loadUpdater);
        clearInterval(this.tempUpdater);
        clearInterval(this.speedUpdater);
        clearInterval(this.tasksUpdater);
    }

}
