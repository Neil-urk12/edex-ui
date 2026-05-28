import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateFilename, validateAndResolve, validateWithin, validateAssetPath } from '../../src/main/ipc-validation.js';

describe('validateFilename - encoded traversal rejection', () => {
  it('rejects URL-encoded .. (%2e%2e)', () => {
    expect(() => validateFilename('%2e%2e')).toThrow(/Invalid/);
  });

  it('rejects URL-encoded ../ (%2e%2e%2f)', () => {
    expect(() => validateFilename('%2e%2e%2f')).toThrow(/Invalid/);
  });

  it('rejects double-encoded .. (%252e%252e)', () => {
    expect(() => validateFilename('%252e%252e')).toThrow(/Invalid/);
  });

  it('rejects URL-encoded null byte (%00)', () => {
    expect(() => validateFilename('file%00name')).toThrow(/Invalid/);
  });

  it('rejects mixed encoding (..%2f)', () => {
    expect(() => validateFilename('..%2f')).toThrow(/Invalid/);
  });

  it('rejects mixed encoding (%2e%2e/)', () => {
    expect(() => validateFilename('%2e%2e/')).toThrow(/Invalid/);
  });

  it('accepts valid filename with spaces', () => {
    expect(() => validateFilename('my file.json')).not.toThrow();
  });

  it('accepts valid filename with dots', () => {
    expect(() => validateFilename('theme.dark.json')).not.toThrow();
  });

  it('accepts valid filename with hyphens', () => {
    expect(() => validateFilename('my-theme_v2.json')).not.toThrow();
  });
});

describe('Symlink escape protection', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'edex-symlink-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('validateWithin: rejects symlink that escapes allowed directory', () => {
    const allowedDir = join(tmpDir, 'allowed');
    mkdirSync(allowedDir, { recursive: true });

    const outsideDir = join(tmpDir, 'outside');
    mkdirSync(outsideDir, { recursive: true });
    writeFileSync(join(outsideDir, 'secret.txt'), 'pwned');

    symlinkSync(outsideDir, join(allowedDir, 'escape'));

    expect(() => validateWithin(join(allowedDir, 'escape', 'secret.txt'), allowedDir))
      .toThrow(/Access denied|outside allowed/);
  });

  it('validateWithin: rejects symlink escape when target file does not exist', () => {
    const allowedDir = join(tmpDir, 'allowed');
    mkdirSync(allowedDir, { recursive: true });

    const outsideDir = join(tmpDir, 'outside');
    mkdirSync(outsideDir, { recursive: true });
    // No file created — tests the realpathSync fallback path

    symlinkSync(outsideDir, join(allowedDir, 'escape'));

    expect(() => validateWithin(join(allowedDir, 'escape', 'newfile.txt'), allowedDir))
      .toThrow(/Access denied|outside allowed/);
  });

  it('validateWithin: rejects symlink that escapes userData', () => {
    const userData = join(tmpDir, 'userData');
    mkdirSync(userData, { recursive: true });

    const outsideDir = join(tmpDir, 'outside');
    mkdirSync(outsideDir, { recursive: true });

    symlinkSync(outsideDir, join(userData, 'link'));

    expect(() => validateWithin(join(userData, 'link', 'file.txt'), userData))
      .toThrow(/Access denied|outside allowed/);
  });

  it('validateWithin: allows valid path within allowed directory', () => {
    const allowedDir = join(tmpDir, 'allowed');
    mkdirSync(join(allowedDir, 'sub'), { recursive: true });
    writeFileSync(join(allowedDir, 'sub', 'file.txt'), 'ok');

    const result = validateWithin(join(allowedDir, 'sub', 'file.txt'), allowedDir);
    expect(result).toContain('allowed');
  });

  it('validateAssetPath: rejects symlink escape in assets', () => {
    const userData = join(tmpDir, 'userData');
    const assetsDir = join(userData, 'assets');
    mkdirSync(assetsDir, { recursive: true });

    const outsideDir = join(tmpDir, 'outside');
    mkdirSync(outsideDir, { recursive: true });

    symlinkSync(outsideDir, join(assetsDir, 'escape'));

    expect(() => validateAssetPath('escape/file.txt', userData))
      .toThrow(/Path traversal|Access denied/);
  });
});

describe('validateAssetPath - guard clause coverage', () => {
  let tmpDir;
  let userData;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'edex-asset-guard-'));
    userData = tmpDir;
    mkdirSync(join(userData, 'assets'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects empty string', () => {
    expect(() => validateAssetPath('', userData)).toThrow(/Invalid path/);
  });

  it('rejects whitespace-only string', () => {
    expect(() => validateAssetPath('   ', userData)).toThrow(/Invalid path/);
  });

  it('rejects null byte in string', () => {
    expect(() => validateAssetPath('file\0name', userData)).toThrow(/Invalid path/);
  });

  it('rejects non-string input null', () => {
    expect(() => validateAssetPath(null, userData)).toThrow(/Invalid path/);
  });

  it('rejects non-string input undefined', () => {
    expect(() => validateAssetPath(undefined, userData)).toThrow(/Invalid path/);
  });

  it('rejects non-string input number', () => {
    expect(() => validateAssetPath(42, userData)).toThrow(/Invalid path/);
  });

  it('accepts valid asset path', () => {
    expect(() => validateAssetPath('image.png', userData)).not.toThrow();
  });
});
