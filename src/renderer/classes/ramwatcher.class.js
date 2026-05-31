const BYTES_PER_GIB = 1073741824; // 2^30

import { POLL_INTERVALS, RAM_POINT_COUNT } from '../constants.js';
import { guardedPoll } from '../utils/poll-guard.js';

class RAMwatcher {
    constructor(parentId) {
        if (!parentId) throw new Error("Missing parameters");

        // Create DOM
        this.parent = document.getElementById(parentId);
        let modExtContainer = document.createElement("div");
        let ramwatcherDOM = `<div id="mod_ramwatcher_inner">
                <h1>MEMORY<i id="mod_ramwatcher_info"></i></h1>
                <div id="mod_ramwatcher_pointmap">`;

		for (let i = 0; i < RAM_POINT_COUNT; i++) {
            ramwatcherDOM += `<div class="mod_ramwatcher_point free"></div>`;
        }

        ramwatcherDOM += `</div>
                <div id="mod_ramwatcher_swapcontainer">
                    <h1>SWAP</h1>
                    <progress id="mod_ramwatcher_swapbar" max="100" value="0"></progress>
                    <h3 id="mod_ramwatcher_swaptext">0.0 GiB</h3>
                </div>
        </div>`;

        modExtContainer.innerHTML = ramwatcherDOM;
        modExtContainer.setAttribute("id", "mod_ramwatcher");
        this.parent.append(modExtContainer);

        this.points = Array.from(document.querySelectorAll("div.mod_ramwatcher_point"));
        this.shuffleArray(this.points);

		this._els = {
			info: document.getElementById('mod_ramwatcher_info'),
			swapBar: document.getElementById('mod_ramwatcher_swapbar'),
			swapText: document.getElementById('mod_ramwatcher_swaptext'),
		};

		this.updateInfo();

        // Init updaters
        this.infoUpdater = setInterval(() => {
            this.updateInfo();
        }, POLL_INTERVALS.RAM);
    }
	updateInfo() {
		guardedPoll(this, 'currentlyUpdating',
			() => window.electronAPI.getMemoryInfo(),
			data => {
				if (data.free+data.used !== data.total) throw new Error('RAM Watcher Error: Bad memory values');

				// Convert the data for the points grid
				let active = Math.round((RAM_POINT_COUNT*data.active)/data.total);
				let available = Math.round((RAM_POINT_COUNT*(data.available-data.free))/data.total);

				// Update grid
				this.points.slice(0, active).forEach(domPoint => {
					if (domPoint.attributes.class.value !== 'mod_ramwatcher_point active') {
						domPoint.setAttribute('class', 'mod_ramwatcher_point active');
					}
				});
				this.points.slice(active, active+available).forEach(domPoint => {
					if (domPoint.attributes.class.value !== 'mod_ramwatcher_point available') {
						domPoint.setAttribute('class', 'mod_ramwatcher_point available');
					}
				});
				this.points.slice(active+available, this.points.length).forEach(domPoint => {
					if (domPoint.attributes.class.value !== 'mod_ramwatcher_point free') {
						domPoint.setAttribute('class', 'mod_ramwatcher_point free');
					}
				});

				// Update info text
				let totalGiB = Math.round((data.total/BYTES_PER_GIB)*10)/10;
				let usedGiB = Math.round((data.active/BYTES_PER_GIB)*10)/10;
				if (this._els.info) this._els.info.innerText = `USING ${usedGiB} OUT OF ${totalGiB} GiB`;

				// Update swap indicator
				let usedSwap = Math.round((100*data.swapused)/data.swaptotal);
				if (this._els.swapBar) this._els.swapBar.value = usedSwap || 0;

				let usedSwapGiB = Math.round((data.swapused/BYTES_PER_GIB)*10)/10;
				if (this._els.swapText) this._els.swapText.innerText = `${usedSwapGiB} GiB`;
			}
		);
	}
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    dispose() {
        clearInterval(this.infoUpdater);
    }
}

export { RAMwatcher };
