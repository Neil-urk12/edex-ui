import { ipcRenderer } from 'electron'

export const systemAPI = {
  getCpuInfo: () => ipcRenderer.invoke('getCpuInfo'),
  getCpuLoad: () => ipcRenderer.invoke('getCpuLoad'),
  getMemoryInfo: () => ipcRenderer.invoke('getMemoryInfo'),
  getCpuTemperature: () => ipcRenderer.invoke('getCpuTemperature'),
  getProcesses: () => ipcRenderer.invoke('getProcesses'),
  getBattery: () => ipcRenderer.invoke('getBattery'),
  getNetworkInterfaces: () => ipcRenderer.invoke('getNetworkInterfaces'),
  getNetworkStats: (iface) => ipcRenderer.invoke('getNetworkStats', iface),
  getBlockDevices: () => ipcRenderer.invoke('getBlockDevices'),
  getFsSize: () => ipcRenderer.invoke('getFsSize')
}
