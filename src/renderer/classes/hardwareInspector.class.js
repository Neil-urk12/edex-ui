// eDEX-UI HardwareInspector Module
import { POLL_INTERVALS } from '../constants.js';
import { guardedPoll } from '../utils/poll-guard.js';
export class HardwareInspector {
    constructor(parentId) {
        if (!parentId) throw new Error("Missing parameters");
        this._updating = false;
        this.parent = document.getElementById(parentId);
        this._element = document.createElement("div");
        this._element.setAttribute("id", "mod_hardwareInspector");
        this._element.innerHTML = `<div id="mod_hardwareInspector_inner">
            <div>
                <h1>MANUFACTURER</h1>
                <h2 id="mod_hardwareInspector_manufacturer">EDEX</h2>
            </div>
            <div>
                <h1>MODEL</h1>
                <h2 id="mod_hardwareInspector_model">SYSTEM</h2>
            </div>
            <div>
                <h1>CHASSIS</h1>
                <h2 id="mod_hardwareInspector_chassis">DESKTOP</h2>
            </div>
        </div>`;

        this.parent.append(this._element);

        this._els = {
            manufacturer: document.getElementById('mod_hardwareInspector_manufacturer'),
            model: document.getElementById('mod_hardwareInspector_model'),
            chassis: document.getElementById('mod_hardwareInspector_chassis'),
        };

        this.updateInfo().catch(() => {}); // errors already warned by guardedPoll
        this._intervalId = setInterval(() => this.updateInfo().catch(() => {}), /* errors already warned by guardedPoll */ POLL_INTERVALS.HARDWARE_INSPECTOR);
    }

    updateInfo() {
        return guardedPoll(this, '_updating',
            () => Promise.all([
                window.electronAPI.getSystemInfo(),
                window.electronAPI.getChassisInfo()
            ]),
            ([data, chassisData]) => {
                if (this._els.manufacturer) this._els.manufacturer.innerText = this._trimDataString(data.manufacturer);
                if (this._els.model) this._els.model.innerText = this._trimDataString(data.model, data.manufacturer, chassisData.type);
                if (this._els.chassis) this._els.chassis.innerText = chassisData.type;
            }
        );
    }

    _trimDataString(str, ...filters) {
        if (!str) return "";
        let result = str.trim();
        if (result === "") return "";

        // Extract maxWords from last argument if it's a number
        let maxWords = 2;
        if (filters.length > 0 && typeof filters[filters.length - 1] === 'number') {
            maxWords = filters.pop();
            if (maxWords < 0) maxWords = 0;
        }

        return result.split(" ").filter(word => {
            if (filters.length === 0) return true;
            if (filters[0] === undefined && filters.length === 1) return true;
            return !filters.includes(word);
        }).slice(0, maxWords).join(" ");
    }

    dispose() {
        clearInterval(this._intervalId);
    }

}
