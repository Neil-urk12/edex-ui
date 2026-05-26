// eDEX-UI Cpuinfo Module (stub - needs IPC for real CPU info)
export class Cpuinfo {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        this.parent = document.getElementById(parentId);
        this.container = document.createElement("div");
        this.container.setAttribute("id", "mod_cpuinfo");
        this.container.innerHTML = `<div id="mod_cpuinfo_innercontainer">
            <h1>CPU USAGE<i>System CPU</i></h1>
            <div>
                <h1># <em>1</em> - <em>--</em><br>
                <i id="mod_cpuinfo_usagecounter0">Avg. --%</i></h1>
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
        this.parent.append(this.container);
    }
}
