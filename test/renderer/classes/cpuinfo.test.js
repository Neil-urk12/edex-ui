// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cpuinfo } from '../../../src/renderer/classes/cpuinfo.class.js';

describe('Cpuinfo', () => {
    let parentElement;
    let mockElectronAPI;

    beforeEach(() => {
        vi.useFakeTimers();

        // Create mock parent element
        parentElement = document.createElement('div');
        parentElement.setAttribute('id', 'test-parent');
        document.body.appendChild(parentElement);

        // Mock electronAPI
        mockElectronAPI = {
            getCpuInfo: vi.fn().mockResolvedValue({
                cores: 8,
                manufacturer: 'Intel',
                brand: 'Core i7-9750H',
                speed: 2.6,
                speedMax: 4.5
            }),
            getCpuLoad: vi.fn().mockResolvedValue({
                cpus: [
                    { load: 45.2 },
                    { load: 32.1 },
                    { load: 67.8 },
                    { load: 23.4 },
                    { load: 55.6 },
                    { load: 41.9 },
                    { load: 38.7 },
                    { load: 52.3 }
                ]
            }),
            getCpuTemperature: vi.fn().mockResolvedValue({
                max: 72
            }),
            getProcesses: vi.fn().mockResolvedValue({
                all: 245
            })
        };
        window.electronAPI = mockElectronAPI;
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
        delete window.electronAPI;
    });

    describe('constructor', () => {
        it('throws "Missing parameters" when parentId is missing', () => {
            expect(() => new Cpuinfo()).toThrow('Missing parameters');
        });

        it('creates DOM container with id "mod_cpuinfo"', () => {
            new Cpuinfo('test-parent');
            const container = document.getElementById('mod_cpuinfo');
            expect(container).toBeTruthy();
            expect(container.id).toBe('mod_cpuinfo');
        });

        it('calls getCpuInfo to initialize', async () => {
            new Cpuinfo('test-parent');
            await vi.waitFor(() => {
                expect(mockElectronAPI.getCpuInfo).toHaveBeenCalled();
            });
        });

        it('sets up polling interval for CPU load at 500ms', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0); // let getCpuInfo resolve

            expect(cpuinfo.loadUpdater).toBeDefined();

            // Fast-forward 500ms
            vi.advanceTimersByTime(500);
            expect(mockElectronAPI.getCpuLoad).toHaveBeenCalled();
        });

        it('sets up polling interval for CPU temperature at 2000ms', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);

            expect(cpuinfo.tempUpdater).toBeDefined();

            // Fast-forward 2000ms
            vi.advanceTimersByTime(2000);
            expect(mockElectronAPI.getCpuTemperature).toHaveBeenCalled();
        });

        it('sets up polling interval for CPU speed at 1000ms', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);

            expect(cpuinfo.speedUpdater).toBeDefined();

            // Fast-forward 1000ms
            vi.advanceTimersByTime(1000);
            expect(mockElectronAPI.getCpuInfo).toHaveBeenCalled();
        });

        it('sets up polling interval for tasks at 5000ms', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);

            expect(cpuinfo.tasksUpdater).toBeDefined();

            // Fast-forward 5000ms
            vi.advanceTimersByTime(5000);
            expect(mockElectronAPI.getProcesses).toHaveBeenCalled();
        });

        it('uses textContent for CPU name, proving raw HTML appears as text not parsed DOM', async () => {
            mockElectronAPI.getCpuInfo.mockResolvedValue({
                cores: 4,
                manufacturer: '<script>alert(1)</script>',
                brand: 'Test',
                speed: 2.0,
                speedMax: 3.0
            });

            new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0); // let getCpuInfo resolve

            // Verify the <i id="mod_cpuinfo_cputitle"> element directly
            const titleElement = document.getElementById('mod_cpuinfo_cputitle');
            expect(titleElement).toBeTruthy();
            // textContent returns the raw string — <script> tag appears as literal text, not parsed HTML
            // This proves textContent was used: if innerHTML were used, the script tag would be
            // parsed and stripped from textContent
            expect(titleElement.textContent).toContain('<script>alert(1)</script>');
        });

        it('uses integer halfCores for odd core counts', async () => {
            mockElectronAPI.getCpuInfo.mockResolvedValue({
                cores: 5,
                manufacturer: 'Intel',
                brand: 'Core i5',
                speed: 3.0,
                speedMax: 4.0
            });

            new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);

            // halfCores = Math.floor(5/2) = 2, not 2.5
            const innerContainer = document.getElementById('mod_cpuinfo_innercontainer');
            expect(innerContainer.innerHTML).toContain('# <em>1</em> - <em>2</em>');
            expect(innerContainer.innerHTML).toContain('# <em>3</em> - <em>5</em>');
        });

        it('resets guard flags when getCpuInfo rejects so polling can recover', async () => {
            mockElectronAPI.getCpuInfo.mockRejectedValue(new Error('IPC failed'));

            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0); // let getCpuInfo reject

            // Guard flags should be reset to false after rejection
            expect(cpuinfo.currentlyUpdating).toBe(false);
            expect(cpuinfo.updatingCPUspeed).toBe(false);
            expect(cpuinfo.updatingCPUtasks).toBe(false);
        });
    });

    describe('_resetGuardFlags', () => {
        it('resets all guard flags to false', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);

            // Set all flags to true
            cpuinfo.currentlyUpdating = true;
            cpuinfo.updatingCPUspeed = true;
            cpuinfo.updatingCPUtasks = true;
            cpuinfo.updatingCPUtemp = true;

            cpuinfo._resetGuardFlags();

            expect(cpuinfo.currentlyUpdating).toBe(false);
            expect(cpuinfo.updatingCPUspeed).toBe(false);
            expect(cpuinfo.updatingCPUtasks).toBe(false);
            expect(cpuinfo.updatingCPUtemp).toBe(false);
        });
    });

    describe('updateCPUload', () => {
        it('calls window.electronAPI.getCpuLoad()', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);
            await cpuinfo.updateCPUload();
            expect(mockElectronAPI.getCpuLoad).toHaveBeenCalled();
        });

        it('updates usage counter DOM elements with average load percentages', async () => {
            mockElectronAPI.getCpuLoad.mockResolvedValue({
                cpus: [
                    { load: 50 },
                    { load: 60 },
                    { load: 40 },
                    { load: 30 },
                    { load: 70 },
                    { load: 80 },
                    { load: 20 },
                    { load: 90 }
                ]
            });

            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);
            await cpuinfo.updateCPUload();

            const counter0 = document.getElementById('mod_cpuinfo_usagecounter0');
            const counter1 = document.getElementById('mod_cpuinfo_usagecounter1');
            expect(counter0).toBeTruthy();
            expect(counter1).toBeTruthy();
            expect(counter0.innerText).toBe('Avg. 45%');
            expect(counter1.innerText).toBe('Avg. 65%');
        });

        it('displays 0% for both halves when cpus array is empty', async () => {
            mockElectronAPI.getCpuLoad.mockResolvedValue({ cpus: [] });

            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);
            await cpuinfo.updateCPUload();

            const counter0 = document.getElementById('mod_cpuinfo_usagecounter0');
            const counter1 = document.getElementById('mod_cpuinfo_usagecounter1');
            expect(counter0).toBeTruthy();
            expect(counter1).toBeTruthy();
            expect(counter0.innerText).toBe('Avg. 0%');
            expect(counter1.innerText).toBe('Avg. 0%');
        });

        it('displays 0% for first half and actual avg for second half when cpus has 1 element', async () => {
            mockElectronAPI.getCpuLoad.mockResolvedValue({ cpus: [{ load: 50 }] });

            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);
            await cpuinfo.updateCPUload();

            const counter0 = document.getElementById('mod_cpuinfo_usagecounter0');
            const counter1 = document.getElementById('mod_cpuinfo_usagecounter1');
            expect(counter0).toBeTruthy();
            expect(counter1).toBeTruthy();
            expect(counter0.innerText).toBe('Avg. 0%');
            expect(counter1.innerText).toBe('Avg. 50%');
        });

        it('guards against concurrent updates', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            cpuinfo.currentlyUpdating = true;

            await cpuinfo.updateCPUload();
            expect(mockElectronAPI.getCpuLoad).not.toHaveBeenCalled();
        });
    });

    describe('updateCPUtemp', () => {
        it('calls window.electronAPI.getCpuTemperature()', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0); // let init resolve
            await cpuinfo.updateCPUtemp();
            expect(mockElectronAPI.getCpuTemperature).toHaveBeenCalled();
        });

        it('updates temp DOM element', async () => {
            mockElectronAPI.getCpuTemperature.mockResolvedValue({ max: 65 });

            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0); // let init resolve
            await cpuinfo.updateCPUtemp();

            const tempElement = document.getElementById('mod_cpuinfo_temp');
            expect(tempElement).toBeTruthy();
            expect(tempElement.innerText).toBe('65°C');
        });

        it('guards against concurrent temperature updates', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0); // let init resolve

            // Manually set the guard flag
            cpuinfo.updatingCPUtemp = true;

            await cpuinfo.updateCPUtemp();
            // Should NOT have called the API since guard was set
            // getCpuTemperature is NOT called during init. So count should be 0.
            expect(mockElectronAPI.getCpuTemperature).not.toHaveBeenCalled();
        });
    });

    describe('updateCPUspeed', () => {
        it('calls window.electronAPI.getCpuInfo()', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            await cpuinfo.updateCPUspeed();
            expect(mockElectronAPI.getCpuInfo).toHaveBeenCalled();
        });

        it('updates speed_min and speed_max DOM elements', async () => {
            mockElectronAPI.getCpuInfo.mockResolvedValue({
                cores: 8,
                speed: 2.6,
                speedMax: 4.5
            });

            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);
            await cpuinfo.updateCPUspeed();

            const speedMin = document.getElementById('mod_cpuinfo_speed_min');
            const speedMax = document.getElementById('mod_cpuinfo_speed_max');
            expect(speedMin).toBeTruthy();
            expect(speedMax).toBeTruthy();
            expect(speedMin.innerText).toBe('2.6GHz');
            expect(speedMax.innerText).toBe('4.5GHz');
        });
    });

    describe('updateCPUtasks', () => {
        it('calls window.electronAPI.getProcesses()', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);
            await cpuinfo.updateCPUtasks();
            expect(mockElectronAPI.getProcesses).toHaveBeenCalled();
        });

        it('updates tasks DOM element', async () => {
            mockElectronAPI.getProcesses.mockResolvedValue({ all: 312 });

            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);
            await cpuinfo.updateCPUtasks();

            const tasksElement = document.getElementById('mod_cpuinfo_tasks');
            expect(tasksElement).toBeTruthy();
            expect(tasksElement.innerText).toBe('312');
        });
    });

    describe('guard flag reset on IPC rejection', () => {
        it('resets currentlyUpdating when getCpuLoad rejects', async () => {
            mockElectronAPI.getCpuLoad.mockRejectedValue(new Error('IPC failed'));

            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);

            // Call method (sets flag, starts promise that rejects)
            cpuinfo.updateCPUload();
            await vi.advanceTimersByTimeAsync(0); // flush microtasks

            expect(cpuinfo.currentlyUpdating).toBe(false);
        });

        it('resets updatingCPUspeed when getCpuInfo rejects in updateCPUspeed', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0); // init with default successful mock

            mockElectronAPI.getCpuInfo.mockRejectedValue(new Error('IPC failed'));

            cpuinfo.updateCPUspeed();
            await vi.advanceTimersByTimeAsync(0);

            expect(cpuinfo.updatingCPUspeed).toBe(false);
        });

        it('resets updatingCPUtasks when getProcesses rejects', async () => {
            mockElectronAPI.getProcesses.mockRejectedValue(new Error('IPC failed'));

            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);

            cpuinfo.updateCPUtasks();
            await vi.advanceTimersByTimeAsync(0);

            expect(cpuinfo.updatingCPUtasks).toBe(false);
        });

        it('does not throw when getCpuTemperature rejects', async () => {
            mockElectronAPI.getCpuTemperature.mockRejectedValue(new Error('IPC failed'));

            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);

            // Should not throw
            cpuinfo.updateCPUtemp();
            await vi.advanceTimersByTimeAsync(0);
        });

        it('resets updatingCPUtemp when getCpuTemperature rejects', async () => {
            mockElectronAPI.getCpuTemperature.mockRejectedValue(new Error('IPC failed'));

            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);

            cpuinfo.updateCPUtemp();
            await vi.advanceTimersByTimeAsync(0);

            expect(cpuinfo.updatingCPUtemp).toBe(false);
        });
    });

    describe('polling cleanup', () => {
        it('stores interval IDs for cleanup', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);

            expect(cpuinfo.loadUpdater).toBeDefined();
            expect(cpuinfo.speedUpdater).toBeDefined();
            expect(cpuinfo.tasksUpdater).toBeDefined();
        });

        it('clears intervals when cleanup is called', async () => {
            const cpuinfo = new Cpuinfo('test-parent');
            await vi.advanceTimersByTimeAsync(0);

            const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

            cpuinfo.cleanup();

            expect(clearIntervalSpy).toHaveBeenCalledWith(cpuinfo.loadUpdater);
            expect(clearIntervalSpy).toHaveBeenCalledWith(cpuinfo.speedUpdater);
            expect(clearIntervalSpy).toHaveBeenCalledWith(cpuinfo.tasksUpdater);
            clearIntervalSpy.mockRestore();
        });
    });
});
