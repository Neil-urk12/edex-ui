/**
 * Tests for system preload bridge
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
  },
}))

describe('system preload bridge', async () => {
  const { ipcRenderer } = await import('electron')
  const { systemAPI } = await import('../../src/preload/system.js')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('existing methods', () => {
    test('getCpuInfo calls ipcRenderer.invoke with correct channel', async () => {
      const mockResult = { manufacturer: 'Intel', brand: 'Core i7', cores: 8 }
      ipcRenderer.invoke.mockResolvedValue(mockResult)

      const result = await systemAPI.getCpuInfo()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getCpuInfo')
      expect(result).toEqual(mockResult)
    })

    test('getCpuLoad calls ipcRenderer.invoke with correct channel', async () => {
      const mockResult = { currentLoad: 45.2, cpus: [] }
      ipcRenderer.invoke.mockResolvedValue(mockResult)

      const result = await systemAPI.getCpuLoad()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getCpuLoad')
      expect(result).toEqual(mockResult)
    })

    test('getMemoryInfo calls ipcRenderer.invoke with correct channel', async () => {
      const mockResult = { total: 16384, free: 8192, used: 8192 }
      ipcRenderer.invoke.mockResolvedValue(mockResult)

      const result = await systemAPI.getMemoryInfo()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getMemoryInfo')
      expect(result).toEqual(mockResult)
    })

    test('getCpuTemperature calls ipcRenderer.invoke with correct channel', async () => {
      const mockResult = { main: 55, cores: [] }
      ipcRenderer.invoke.mockResolvedValue(mockResult)

      const result = await systemAPI.getCpuTemperature()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getCpuTemperature')
      expect(result).toEqual(mockResult)
    })

    test('getProcesses calls ipcRenderer.invoke with correct channel', async () => {
      const mockResult = { all: 150, running: 3, list: [] }
      ipcRenderer.invoke.mockResolvedValue(mockResult)

      const result = await systemAPI.getProcesses()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getProcesses')
      expect(result).toEqual(mockResult)
    })

    test('getBattery calls ipcRenderer.invoke with correct channel', async () => {
      const mockResult = { hasBattery: true, percent: 85 }
      ipcRenderer.invoke.mockResolvedValue(mockResult)

      const result = await systemAPI.getBattery()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getBattery')
      expect(result).toEqual(mockResult)
    })

    test('getNetworkInterfaces calls ipcRenderer.invoke with correct channel', async () => {
      const mockResult = [{ iface: 'eth0', ip4: '192.168.1.100' }]
      ipcRenderer.invoke.mockResolvedValue(mockResult)

      const result = await systemAPI.getNetworkInterfaces()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getNetworkInterfaces')
      expect(result).toEqual(mockResult)
    })

    test('getNetworkStats calls ipcRenderer.invoke with iface argument', async () => {
      const mockResult = [{ iface: 'eth0', rx_bytes: 1024, tx_bytes: 512 }]
      ipcRenderer.invoke.mockResolvedValue(mockResult)

      const result = await systemAPI.getNetworkStats('eth0')

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getNetworkStats', 'eth0')
      expect(result).toEqual(mockResult)
    })

    test('getBlockDevices calls ipcRenderer.invoke with correct channel', async () => {
      const mockResult = [{ name: '/dev/sda1', size: 512000000000 }]
      ipcRenderer.invoke.mockResolvedValue(mockResult)

      const result = await systemAPI.getBlockDevices()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getBlockDevices')
      expect(result).toEqual(mockResult)
    })

    test('getFsSize calls ipcRenderer.invoke with correct channel', async () => {
      const mockResult = [{ fs: '/dev/sda1', size: 512000000000, used: 256000000000 }]
      ipcRenderer.invoke.mockResolvedValue(mockResult)

      const result = await systemAPI.getFsSize()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getFsSize')
      expect(result).toEqual(mockResult)
    })
  })

  describe('new system info methods', () => {
    test('getSystemInfo calls ipcRenderer.invoke with correct channel', async () => {
      const mockResult = { manufacturer: 'Dell', model: 'XPS 15', serial: 'ABC123', uuid: 'test-uuid', sku: 'SKU-001' }
      ipcRenderer.invoke.mockResolvedValue(mockResult)

      const result = await systemAPI.getSystemInfo()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getSystemInfo')
      expect(result).toEqual(mockResult)
    })

    test('getChassisInfo calls ipcRenderer.invoke with correct channel', async () => {
      const mockResult = { manufacturer: 'Dell', model: 'XPS 15', type: 'Notebook' }
      ipcRenderer.invoke.mockResolvedValue(mockResult)

      const result = await systemAPI.getChassisInfo()

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('getChassisInfo')
      expect(result).toEqual(mockResult)
    })
  })
})
