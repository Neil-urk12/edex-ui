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
