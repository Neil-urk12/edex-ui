// eDEX-UI HardwareInspector Module
export class HardwareInspector {
    constructor(parentId) {
        if (!parentId) throw new Error("Missing parameters");

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
        Promise.all([
            window.electronAPI.getSystemInfo(),
            window.electronAPI.getChassisInfo()
        ]).then(([data, chassisData]) => {
            document.getElementById("mod_hardwareInspector_manufacturer").innerText = this._trimDataString(data.manufacturer);
            document.getElementById("mod_hardwareInspector_model").innerText = this._trimDataString(data.model, data.manufacturer, chassisData.type);
            document.getElementById("mod_hardwareInspector_chassis").innerText = chassisData.type;
        }).catch(err => console.warn('[HardwareInspector]', err));
    }

    _trimDataString(str, ...filters) {
        if (!str) return "";
        filters = [...filters];
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

    cleanup() {
        clearInterval(this._intervalId);
    }
}
