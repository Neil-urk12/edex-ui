// eDEX-UI HardwareInspector Module (stub - needs IPC for real hardware info)
export class HardwareInspector {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

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
    }
}
