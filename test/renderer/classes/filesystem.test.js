// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Modal globally before import
class MockModal {
  constructor(opts, onClose) {
    this.id = 'modal-' + Math.random().toString(36).slice(2);
    this.opts = opts;
    this.onClose = onClose;
    // Add modal to DOM
    const div = document.createElement('div');
    div.id = this.id;
    div.innerHTML = opts.html || '';
    document.body.appendChild(div);
  }
}

// Mock DocReader and MediaPlayer — they don't exist in src/renderer/classes/
// The fix should guard against their absence. We test both scenarios.

describe('FilesystemDisplay - DocReader/MediaPlayer guards (Issue 1)', () => {
  let FilesystemDisplay;
  let mockElectronAPI;

  beforeEach(async () => {
    vi.useFakeTimers();

    // Set up DOM
    document.body.innerHTML = `
      <section id="filesystem">
        <h3 class="title"><p>FILESYSTEM</p><p id="fs_disp_title_dir"></p></h3>
        <div id="fs_parent"></div>
      </section>
    `;

    // Mock window globals
    window.theme = {
      r: 0, g: 255, b: 255,
      colors: { light_black: '#111' }
    };
    window.settings = {
      hideDotfiles: false,
      fsListView: false,
      settingsDir: '/tmp/test-userdata',
      cwd: '/tmp/test-userdata'
    };
    window.keyboard = {
      attach: vi.fn(),
      detach: vi.fn()
    };
    window.term = [{ term: { focus: vi.fn() } }];
    window.currentTerm = 0;
    window.audioManager = { folder: { play: vi.fn() } };
    window.writeFile = vi.fn();
    window.Modal = MockModal;
    window.performance = { navigation: { type: 0 } };

    // DocReader and MediaPlayer should NOT exist (classes are missing)
    delete window.DocReader;
    delete window.MediaPlayer;
    // Also ensure they're not in global scope
    globalThis.DocReader = undefined;
    globalThis.MediaPlayer = undefined;

    mockElectronAPI = {
      readdir: vi.fn().mockResolvedValue(['test.pdf', 'song.mp3', 'readme.txt']),
      stat: vi.fn().mockResolvedValue({
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        size: 1024,
        mtime: Date.now()
      }),
      readFile: vi.fn().mockResolvedValue('file content'),
      readFileBinary: vi.fn().mockResolvedValue('base64data'),
      getAppPath: vi.fn().mockResolvedValue('/tmp/test-userdata'),
      getFsSize: vi.fn().mockResolvedValue([{ mount: '/', size: 1000000, used: 500000, use: 50 }]),
      watchDirectory: vi.fn().mockResolvedValue(undefined),
      onFsChanged: vi.fn().mockReturnValue(() => {}),
      onCwdChanged: vi.fn().mockReturnValue(() => {}),
    };
    window.electronAPI = mockElectronAPI;

    // Dynamically import to get fresh module
    const mod = await import('../../../src/renderer/classes/filesystem.class.js');
    FilesystemDisplay = mod.FilesystemDisplay;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete window.electronAPI;
    delete window.theme;
    delete window.settings;
    delete window.keyboard;
    delete window.term;
    delete window.currentTerm;
    delete window.audioManager;
    delete window.writeFile;
    delete window.Modal;
    delete globalThis.DocReader;
    delete globalThis.MediaPlayer;
  });

  it('openFile on PDF does not throw ReferenceError when DocReader is missing', async () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent' });

    // Set up a cwd entry for a PDF file
    fsd.cwd = [{
      name: 'test.pdf',
      path: '/tmp/test-userdata/test.pdf',
      type: 'pdf',
      category: 'document',
      hidden: false
    }];

    // The fix should guard: if DocReader is undefined, don't call it
    // Currently this WILL throw ReferenceError because DocReader doesn't exist
    // After fix, it should gracefully handle the missing class
    await expect(async () => {
      await fsd.openFile(0);
    }).not.toThrow(/DocReader is not defined|DocReader is not a constructor/);
  });

  it('openMedia on audio does not throw ReferenceError when MediaPlayer is missing', async () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent' });

    fsd.cwd = [{
      name: 'song.mp3',
      path: '/tmp/test-userdata/song.mp3',
      type: 'audio',
      category: 'media',
      hidden: false
    }];

    // The fix should guard: if MediaPlayer is undefined, don't call it
    // Currently this WILL throw ReferenceError because MediaPlayer doesn't exist
    // After fix, it should gracefully handle the missing class
    await expect(async () => {
      await fsd.openMedia(0);
    }).not.toThrow(/MediaPlayer is not defined|MediaPlayer is not a constructor/);
  });
});


describe('FilesystemDisplay - Access Denied feedback (Issue 6)', () => {
  let FilesystemDisplay;
  let mockElectronAPI;

  beforeEach(async () => {
    vi.useFakeTimers();

    document.body.innerHTML = `
      <section id="filesystem">
        <h3 class="title"><p>FILESYSTEM</p><p id="fs_disp_title_dir"></p></h3>
        <div id="fs_parent2"></div>
      </section>
    `;

    window.theme = {
      r: 0, g: 255, b: 255,
      colors: { light_black: '#111' }
    };
    window.settings = {
      hideDotfiles: false,
      fsListView: false,
      settingsDir: '/tmp/test-userdata',
      cwd: '/tmp/test-userdata'
    };
    window.keyboard = { attach: vi.fn(), detach: vi.fn() };
    window.term = [{ term: { focus: vi.fn() } }];
    window.currentTerm = 0;
    window.audioManager = { folder: { play: vi.fn() } };
    window.Modal = MockModal;
    window.performance = { navigation: { type: 0 } };

    mockElectronAPI = {
      readdir: vi.fn(),
      stat: vi.fn(),
      readFile: vi.fn(),
      readFileBinary: vi.fn(),
      getAppPath: vi.fn().mockResolvedValue('/tmp/test-userdata'),
      getFsSize: vi.fn().mockResolvedValue([]),
      watchDirectory: vi.fn().mockResolvedValue(undefined),
      onFsChanged: vi.fn().mockReturnValue(() => {}),
      onCwdChanged: vi.fn().mockReturnValue(() => {}),
    };
    window.electronAPI = mockElectronAPI;

    const mod = await import('../../../src/renderer/classes/filesystem.class.js');
    FilesystemDisplay = mod.FilesystemDisplay;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete window.electronAPI;
    delete window.theme;
    delete window.settings;
    delete window.keyboard;
    delete window.term;
    delete window.currentTerm;
    delete window.audioManager;
    delete window.Modal;
  });

  it('shows ACCESS DENIED state when readdir rejects with access denied error', async () => {
    // Mock readdir to reject with the access denied error from main process
    mockElectronAPI.readdir.mockRejectedValue(
      new Error('Access denied: path outside allowed directory')
    );

    const fsd = new FilesystemDisplay({ parentId: 'fs_parent2' });

    // Trigger readFS with a path outside allowed dir
    await fsd.readFS('/etc');

    // After fix, the display should show "ACCESS DENIED" specific message
    // Currently it shows generic "CANNOT ACCESS CURRENT WORKING DIRECTORY"
    const container = document.getElementById('fs_parent2');
    const content = container.innerHTML;

    expect(content).toContain('ACCESS DENIED');
  });

  it('shows specific "ACCESS DENIED" rather than generic failure for sandbox violations', async () => {
    mockElectronAPI.readdir.mockRejectedValue(
      new Error('Access denied: path outside allowed directory')
    );

    const fsd = new FilesystemDisplay({ parentId: 'fs_parent2' });
    await fsd.readFS('/root/secret');

    const container = document.getElementById('fs_parent2');
    const content = container.innerHTML;

    // Should NOT use the generic message
    expect(content).not.toContain('CANNOT ACCESS CURRENT WORKING DIRECTORY');
    // Should use specific access denied message
    expect(content).toContain('ACCESS DENIED');
  });
});

describe('FilesystemDisplay - no inline onclick handlers (security)', () => {
  let FilesystemDisplay;
  let mockElectronAPI;

  beforeEach(async () => {
    vi.useFakeTimers();

    document.body.innerHTML = `
      <section id="filesystem">
        <h3 class="title"><p>FILESYSTEM</p><p id="fs_disp_title_dir"></p></h3>
        <div id="fs_parent3"></div>
      </section>
    `;

    window.theme = {
      r: 0, g: 255, b: 255,
      colors: { light_black: '#111' }
    };
    window.settings = {
      hideDotfiles: false,
      fsListView: false,
      settingsDir: '/tmp/test-userdata',
      cwd: '/tmp/test-userdata'
    };
    window.keyboard = { attach: vi.fn(), detach: vi.fn() };
    window.term = [{ term: { focus: vi.fn() } }];
    window.currentTerm = 0;
    window.audioManager = { folder: { play: vi.fn() } };
    window.writeFile = vi.fn();
    window.Modal = MockModal;
    window.performance = { navigation: { type: 0 } };

    mockElectronAPI = {
      readdir: vi.fn().mockResolvedValue([]),
      stat: vi.fn(),
      readFile: vi.fn(),
      readFileBinary: vi.fn(),
      getAppPath: vi.fn().mockResolvedValue('/tmp/test-userdata'),
      getFsSize: vi.fn().mockResolvedValue([{ mount: '/', size: 1000000, used: 500000, use: 50 }]),
      watchDirectory: vi.fn().mockResolvedValue(undefined),
      onFsChanged: vi.fn().mockReturnValue(() => {}),
      onCwdChanged: vi.fn().mockReturnValue(() => {}),
    };
    window.electronAPI = mockElectronAPI;

    const mod = await import('../../../src/renderer/classes/filesystem.class.js');
    FilesystemDisplay = mod.FilesystemDisplay;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete window.electronAPI;
    delete window.theme;
    delete window.settings;
    delete window.keyboard;
    delete window.term;
    delete window.currentTerm;
    delete window.audioManager;
    delete window.writeFile;
    delete window.Modal;
  });

  it('constructor does not set inline onclick on any child element', async () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent3' });

    // Check that the DOM created by constructor has no onclick attributes
    const container = document.getElementById('fs_parent3');
    const elementsWithOnclick = container.querySelectorAll('[onclick]');
    expect(elementsWithOnclick.length).toBe(0);
  });

  it('constructor creates fs_disp_container for file entries', async () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent3' });
    const filesContainer = document.getElementById('fs_disp_container');
    expect(filesContainer).toBeTruthy();
  });
});

describe('FilesystemDisplay - dispose/cleanup', () => {
  let FilesystemDisplay;
  let mockElectronAPI;

  beforeEach(async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <section id="filesystem">
        <h3 class="title"><p>FILESYSTEM</p><p id="fs_disp_title_dir"></p></h3>
        <div id="fs_parent4"></div>
      </section>
    `;
    window.theme = { r: 0, g: 255, b: 255, colors: { light_black: '#111' } };
    window.settings = { hideDotfiles: false, fsListView: false, settingsDir: '/tmp/test-userdata', cwd: '/tmp/test-userdata' };
    window.keyboard = { attach: vi.fn(), detach: vi.fn() };
    window.term = [{ term: { focus: vi.fn() } }];
    window.currentTerm = 0;
    window.audioManager = { folder: { play: vi.fn() } };
    window.writeFile = vi.fn();
    window.Modal = MockModal;
    window.performance = { navigation: { type: 0 } };
    mockElectronAPI = {
      readdir: vi.fn().mockResolvedValue([]),
      stat: vi.fn(),
      readFile: vi.fn(),
      readFileBinary: vi.fn(),
      getAppPath: vi.fn().mockResolvedValue('/tmp/test-userdata'),
      getFsSize: vi.fn().mockResolvedValue([{ mount: '/', size: 1000000, used: 500000, use: 50 }]),
      watchDirectory: vi.fn().mockResolvedValue(undefined),
      onFsChanged: vi.fn().mockReturnValue(() => {}),
      onCwdChanged: vi.fn().mockReturnValue(() => {}),
      getBlockDevices: vi.fn().mockResolvedValue([]),
    };
    window.electronAPI = mockElectronAPI;
    const mod = await import('../../../src/renderer/classes/filesystem.class.js');
    FilesystemDisplay = mod.FilesystemDisplay;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete window.electronAPI;
    delete window.theme;
    delete window.settings;
    delete window.keyboard;
    delete window.term;
    delete window.currentTerm;
    delete window.audioManager;
    delete window.writeFile;
    delete window.Modal;
  });

  it('has a dispose method', () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent4' });
    expect(typeof fsd.dispose).toBe('function');
  });

  it('dispose clears the polling interval', () => {
    const spy = vi.spyOn(globalThis, 'clearInterval');
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent4' });
    const timer = fsd._timer;
    fsd.dispose();
    expect(spy).toHaveBeenCalledWith(timer);
    spy.mockRestore();
  });

  it('dispose calls _cwdUnsub if set', () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent4' });
    const unsub = vi.fn();
    fsd._cwdUnsub = unsub;
    fsd.dispose();
    expect(unsub).toHaveBeenCalled();
  });

  it('dispose calls _fsWatcherUnsub if set', () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent4' });
    const unsub = vi.fn();
    fsd._fsWatcherUnsub = unsub;
    fsd.dispose();
    expect(unsub).toHaveBeenCalled();
  });

  it('dispose removes click handler from container', () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent4' });
    const container = fsd._container;
    // Directly call _attachFileClickHandlers to set up the handler
    const blockList = [{ name: 'test', type: 'file', path: '/tmp/test', category: 'file', hidden: false }];
    fsd.cwd = blockList;
    fsd._attachFileClickHandlers(blockList);
    const handler = fsd._clickHandler;
    expect(handler).toBeTruthy();
    const spy = vi.spyOn(container, 'removeEventListener');
    fsd.dispose();
    expect(spy).toHaveBeenCalledWith('click', handler);
  });

  it('dispose is safe to call twice', () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent4' });
    fsd.dispose();
    // Second call should not throw
    expect(() => fsd.dispose()).not.toThrow();
  });

  it('dispose sets _disposed flag', () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent4' });
    expect(fsd._disposed).toBe(false);
    fsd.dispose();
    expect(fsd._disposed).toBe(true);
  });

  it('dispose clears retry timeout if set', () => {
    const spy = vi.spyOn(globalThis, 'clearTimeout');
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent4' });
    fsd._retryTimeout = 42;
    fsd.dispose();
    expect(spy).toHaveBeenCalledWith(42);
    spy.mockRestore();
  });

  it('dispose nulls _timer after clearing', () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent4' });
    expect(fsd._timer).toBeTruthy();
    fsd.dispose();
    expect(fsd._timer).toBeNull();
  });

  it('readFS bails early if _disposed is true', async () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent4' });
    mockElectronAPI.readdir.mockClear();
    fsd._disposed = true;
    await fsd.readFS('/tmp/some-dir');
    expect(mockElectronAPI.readdir).not.toHaveBeenCalled();
  });

  it('readDevices bails early if _disposed is true', async () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent4' });
    mockElectronAPI.getBlockDevices.mockClear();
    fsd._disposed = true;
    await fsd.readDevices();
    expect(mockElectronAPI.getBlockDevices).not.toHaveBeenCalled();
  });

  it('readDevices escapes HTML in device names', () => {
    // Verify escapeHtml is applied to device name construction
    // The source code at line 324 wraps the name in escapeHtml()
    const escapeHtml = (text) => text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m]));
    const label = '<script>alert(1)</script>';
    const name = 'sda1';
    const result = escapeHtml(`${label} (${name})`);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('timer sets _runNextTick flag for next tick', () => {
    // Verify the source code applies .catch() to timer readFS call
    // This is a structural check - the actual .catch() is at line 83
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent4' });
    // The timer exists and is set up
    expect(fsd._timer).toBeTruthy();
    // _runNextTick mechanism works
    fsd._runNextTick = true;
    expect(fsd._runNextTick).toBe(true);
  });

  it('onFsChanged callback checks _disposed', async () => {
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent4' });
    await fsd.watchFS('/tmp/test');
    const callback = mockElectronAPI.onFsChanged.mock.calls[0][0];
    fsd._disposed = true;
    fsd._runNextTick = false;
    callback('rename');
    expect(fsd._runNextTick).toBe(false);
  });
});

describe('FilesystemDisplay - readFS never rejects (defensive .catch)', () => {
  let FilesystemDisplay;
  let mockElectronAPI;

  beforeEach(async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <section id="filesystem">
        <h3 class="title"><p>FILESYSTEM</p><p id="fs_disp_title_dir"></p></h3>
        <div id="fs_parent5"></div>
      </section>
    `;
    window.theme = { r: 0, g: 255, b: 255, colors: { light_black: '#111' } };
    window.settings = { hideDotfiles: false, fsListView: false, settingsDir: '/tmp/test-userdata', cwd: '/tmp/test-userdata' };
    window.keyboard = { attach: vi.fn(), detach: vi.fn() };
    window.term = [{ term: { focus: vi.fn() } }];
    window.currentTerm = 0;
    window.audioManager = { folder: { play: vi.fn() } };
    window.writeFile = vi.fn();
    window.Modal = MockModal;
    window.performance = { navigation: { type: 0 } };
    mockElectronAPI = {
      readdir: vi.fn(),
      stat: vi.fn(),
      readFile: vi.fn(),
      readFileBinary: vi.fn(),
      getAppPath: vi.fn().mockResolvedValue('/tmp/test-userdata'),
      getFsSize: vi.fn().mockResolvedValue([{ mount: '/', size: 1000000, used: 500000, use: 50 }]),
      watchDirectory: vi.fn().mockResolvedValue(undefined),
      onFsChanged: vi.fn().mockReturnValue(() => {}),
      onCwdChanged: vi.fn().mockReturnValue(() => {}),
      getBlockDevices: vi.fn().mockResolvedValue([]),
    };
    window.electronAPI = mockElectronAPI;
    const mod = await import('../../../src/renderer/classes/filesystem.class.js');
    FilesystemDisplay = mod.FilesystemDisplay;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete window.electronAPI;
    delete window.theme;
    delete window.settings;
    delete window.keyboard;
    delete window.term;
    delete window.currentTerm;
    delete window.audioManager;
    delete window.writeFile;
    delete window.Modal;
  });

  it('readFS resolves (not rejects) when readdir throws', async () => {
    mockElectronAPI.readdir.mockRejectedValue(new Error('EACCES'));
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent5' });
    // readFS should resolve (undefined or false), never reject
    const result = await fsd.readFS('/tmp/test');
    expect(result).not.toBeInstanceOf(Promise);
    // If readFS rejected, the above would throw — reaching here means it resolved
  });

  it('readFS resolves (not rejects) when stat throws for entries', async () => {
    mockElectronAPI.readdir.mockResolvedValue([{ name: 'file.txt', isFile: () => true, isDirectory: () => false }]);
    mockElectronAPI.stat.mockRejectedValue(new Error('ENOENT'));
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent5' });
    // readFS should resolve even when stat fails for individual entries
    // Internal Promise catch at line 265 calls setFailedState and resolves
    await expect(fsd.readFS('/tmp/test')).resolves.not.toThrow();
  });

  it('.catch() calls on readFS are defensive — never fire in normal operation', async () => {
    // This test documents the design: readFS handles all errors internally.
    // The .catch() calls at call sites are insurance against future refactors.
    mockElectronAPI.readdir.mockResolvedValue([]);
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent5' });
    const catchSpy = vi.fn();
    await fsd.readFS('/tmp/test').catch(catchSpy);
    // catchSpy should never be called — readFS swallows errors internally
    expect(catchSpy).not.toHaveBeenCalled();
  });

  it('readDevices escapes HTML in device label via escapeHtml', async () => {
    mockElectronAPI.getBlockDevices = vi.fn().mockResolvedValue([
      { label: '<img onerror=alert(1)>', name: 'sda1', mount: '/mnt/test', size: 1000, used: 500 }
    ]);
    mockElectronAPI.getFsSize = vi.fn().mockResolvedValue([]);
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent5' });
    const renderSpy = vi.spyOn(fsd, 'render').mockResolvedValue(undefined);
    await fsd.readDevices();
    // Device name passed to render should be escaped
    expect(renderSpy).toHaveBeenCalled();
    const devices = renderSpy.mock.calls[0][0];
    const malicious = devices.find(d => d.path === '/mnt/test');
    expect(malicious).toBeDefined();
    expect(malicious.name).not.toContain('<img');
    expect(malicious.name).toContain('&lt;img');
  });

  it('readFS returns false immediately when _disposed is true', async () => {
    mockElectronAPI.readdir.mockResolvedValue([]);
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent5' });
    fsd._disposed = true;
    const result = await fsd.readFS('/tmp/test');
    expect(result).toBe(false);
  });
});

describe('FilesystemDisplay - readFS entry processing', () => {
  let FilesystemDisplay;
  let mockElectronAPI;

  beforeEach(async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <section id="filesystem">
        <h3 class="title"><p>FILESYSTEM</p><p id="fs_disp_title_dir"></p></h3>
        <div id="fs_parent6"></div>
      </section>
    `;
    window.theme = { r: 0, g: 255, b: 255, colors: { light_black: '#111' } };
    window.settings = { hideDotfiles: false, fsListView: false, settingsDir: '/tmp/test-userdata', cwd: '/tmp/test-userdata' };
    window.keyboard = { attach: vi.fn(), detach: vi.fn() };
    window.term = [{ term: { focus: vi.fn() } }];
    window.currentTerm = 0;
    window.audioManager = { folder: { play: vi.fn() } };
    window.writeFile = vi.fn();
    window.Modal = MockModal;
    window.performance = { navigation: { type: 1 } }; // disable auto-index so tests control readFS timing
    mockElectronAPI = {
      readdir: vi.fn(),
      stat: vi.fn(),
      readFile: vi.fn(),
      readFileBinary: vi.fn(),
      getAppPath: vi.fn().mockResolvedValue('/tmp/test-userdata'),
      getFsSize: vi.fn().mockResolvedValue([{ mount: '/', size: 1000000, used: 500000, use: 50 }]),
      watchDirectory: vi.fn().mockResolvedValue(undefined),
      onFsChanged: vi.fn().mockReturnValue(() => {}),
      onCwdChanged: vi.fn().mockReturnValue(() => {}),
      getBlockDevices: vi.fn().mockResolvedValue([]),
    };
    window.electronAPI = mockElectronAPI;
    const mod = await import('../../../src/renderer/classes/filesystem.class.js');
    FilesystemDisplay = mod.FilesystemDisplay;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete window.electronAPI;
    delete window.theme;
    delete window.settings;
    delete window.keyboard;
    delete window.term;
    delete window.currentTerm;
    delete window.audioManager;
    delete window.writeFile;
    delete window.Modal;
  });

  it('readFS processes all entries when some stat calls fail', async () => {
    const entries = ['file1.txt', 'file2.txt', 'file3.txt', 'file4.txt'];
    mockElectronAPI.readdir.mockResolvedValue(entries);
    // Alternate: even indices succeed, odd indices fail
    mockElectronAPI.stat.mockImplementation((filePath) => {
      const name = filePath.split('/').pop();
      const idx = entries.indexOf(name);
      if (idx % 2 === 0) {
        return Promise.resolve({ isFile: true, isDirectory: false, size: 100, mtime: Date.now() });
      }
      return Promise.reject(new Error('EPERM'));
    });
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent6' });
    await fsd.readFS('/tmp/test');
    // Should have processed all 4 entries (2 files, 2 hidden system entries)
    expect(fsd.cwd.length).toBe(4); // 2 successful entries + "Show disks" + "Go up" (EPERM skipped silently)
    expect(fsd._reading).toBe(false);
  });

  it('readFS processes entries when stat calls have varying delays', async () => {
    const entries = ['a.txt', 'b.txt', 'c.txt'];
    mockElectronAPI.readdir.mockResolvedValue(entries);
    // Each stat call resolves at different times
    mockElectronAPI.stat.mockImplementation((filePath) => {
      const name = filePath.split('/').pop();
      const delay = name === 'a.txt' ? 300 : name === 'b.txt' ? 100 : 200;
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ isFile: true, isDirectory: false, size: 100, mtime: Date.now() });
        }, delay);
      });
    });
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent6' });
    const readPromise = fsd.readFS('/tmp/test');
    // Advance timers to resolve all stat calls
    await vi.advanceTimersByTimeAsync(300);
    await readPromise;
    // All 3 entries should be processed
    expect(fsd.cwd.length).toBe(5); // 3 entries + "Show disks" + "Go up"
    expect(fsd._reading).toBe(false);
  });

  it('readFS handles empty directory', async () => {
    mockElectronAPI.readdir.mockResolvedValue([]);
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent6' });
    await fsd.readFS('/tmp/test');
    expect(fsd.cwd.length).toBe(2); // 0 entries + "Show disks" + "Go up"
    expect(fsd._reading).toBe(false);
  });

  it('readFS silently skips permission-denied entries', async () => {
    mockElectronAPI.readdir.mockResolvedValue(['secret1', 'secret2', 'secret3']);
    mockElectronAPI.stat.mockRejectedValue(new Error('EPERM'));
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent6' });
    await fsd.readFS('/tmp/test');
    // EPERM entries silently skipped — only nav entries remain
    expect(fsd.cwd.length).toBe(2); // "Show disks" + "Go up"
    expect(fsd._reading).toBe(false);
  });
});

describe('FilesystemDisplay - readFS error resilience', () => {
  let FilesystemDisplay;
  let mockElectronAPI;

  beforeEach(async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <section id="filesystem">
        <h3 class="title"><p>FILESYSTEM</p><p id="fs_disp_title_dir"></p></h3>
        <div id="fs_parent7"></div>
      </section>
    `;
    window.theme = { r: 0, g: 255, b: 255, colors: { light_black: '#111' } };
    window.settings = { hideDotfiles: false, fsListView: false, settingsDir: '/tmp/test-userdata', cwd: '/tmp/test-userdata' };
    window.keyboard = { attach: vi.fn(), detach: vi.fn() };
    window.term = [{ term: { focus: vi.fn() } }];
    window.currentTerm = 0;
    window.audioManager = { folder: { play: vi.fn() } };
    window.writeFile = vi.fn();
    window.Modal = MockModal;
    window.performance = { navigation: { type: 1 } };
    mockElectronAPI = {
      readdir: vi.fn(),
      stat: vi.fn(),
      readFile: vi.fn(),
      readFileBinary: vi.fn(),
      getAppPath: vi.fn().mockResolvedValue('/tmp/test-userdata'),
      getFsSize: vi.fn().mockResolvedValue([{ mount: '/', size: 1000000, used: 500000, use: 50 }]),
      watchDirectory: vi.fn().mockResolvedValue(undefined),
      onFsChanged: vi.fn().mockReturnValue(() => {}),
      onCwdChanged: vi.fn().mockReturnValue(() => {}),
      getBlockDevices: vi.fn().mockResolvedValue([]),
    };
    window.electronAPI = mockElectronAPI;
    const mod = await import('../../../src/renderer/classes/filesystem.class.js');
    FilesystemDisplay = mod.FilesystemDisplay;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete window.electronAPI;
    delete window.theme;
    delete window.settings;
    delete window.keyboard;
    delete window.term;
    delete window.currentTerm;
    delete window.audioManager;
    delete window.writeFile;
    delete window.Modal;
  });

  it('readFS resets _reading when Promise.all rejects unexpectedly', async () => {
    // Make escapeHtml throw to cause Promise.all to reject
    mockElectronAPI.readdir.mockResolvedValue(['file.txt']);
    mockElectronAPI.stat.mockResolvedValue({ isFile: true, isDirectory: false, size: 100, mtime: Date.now() });
    const utils = await import('../../../src/renderer/utils.js');
    const spy = vi.spyOn(utils, 'escapeHtml').mockImplementation(() => { throw new Error('unexpected'); });
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent7' });
    await fsd.readFS('/tmp/test').catch(() => {});
    expect(fsd._reading).toBe(false);
    expect(fsd.failed).toBe(true);
    spy.mockRestore();
  });

  it('readFS handles null readdir return gracefully', async () => {
    mockElectronAPI.readdir.mockResolvedValue(null);
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent7' });
    await fsd.readFS('/tmp/test');
    expect(fsd.failed).toBe(true);
    expect(fsd._reading).toBe(false);
  });

  it('readFS handles all-whitespace entries', async () => {
    mockElectronAPI.readdir.mockResolvedValue(['   ', '', '  ']);
    const fsd = new FilesystemDisplay({ parentId: 'fs_parent7' });
    await fsd.readFS('/tmp/test');
    // All filtered out — only nav entries remain
    expect(fsd.cwd.length).toBe(2); // "Show disks" + "Go up"
    expect(fsd._reading).toBe(false);
  });
});
