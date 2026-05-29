// eDEX-UI HardwareInspector Module
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

        this.updateInfo();
        this._intervalId = setInterval(() => this.updateInfo(), 20000);
    }

    updateInfo() {
        if (this._updating) return;
        this._updating = true;
        Promise.all([
            window.electronAPI.getSystemInfo(),
            window.electronAPI.getChassisInfo()
        ]).then(([data, chassisData]) => {
            const elManufacturer = document.getElementById("mod_hardwareInspector_manufacturer");
            if (elManufacturer) elManufacturer.innerText = this._trimDataString(data.manufacturer);
            const elModel = document.getElementById("mod_hardwareInspector_model");
            if (elModel) elModel.innerText = this._trimDataString(data.model, data.manufacturer, chassisData.type);
            const elChassis = document.getElementById("mod_hardwareInspector_chassis");
            if (elChassis) elChassis.innerText = chassisData.type;
            this._updating = false;
        }).catch(err => { console.warn('[HardwareInspector]', err); this._updating = false; });
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

    /** @deprecated Use dispose() */
    cleanup() { this.dispose(); }
}
