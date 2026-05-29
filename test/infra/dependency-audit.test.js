import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PKG_PATH = path.resolve(process.cwd(), 'package.json');
const LOCK_PATH = path.resolve(process.cwd(), 'package-lock.json');

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));

describe('Dependency Audit', () => {
  describe('electron-builder version is >= 24.0.0', () => {
    it('electron-builder should be at least 24.0.0 to avoid known vulnerabilities', () => {
      const raw = pkg.dependencies['electron-builder'];
      expect(raw, 'electron-builder exists in dependencies').toBeDefined();

      // Strip leading ^ or ~ to get minimum version
      const version = raw.replace(/^[^0-9]*/, '');
      const [major, minor, patch] = version.split('.').map(Number);
      const isAtLeast24 = major > 24 || (major === 24 && (minor > 0 || patch > 0));

      expect(
        isAtLeast24,
        `electron-builder is ${raw}, need >= 24.0.0`
      ).toBe(true);
    });
  });

  describe('no exact-pinned critical dependencies', () => {
    const MUST_USE_RANGE = ['howler', 'systeminformation', 'smoothie', 'which', 'shell-env', 'node-json-minify'];

    for (const dep of MUST_USE_RANGE) {
      it(`${dep} should use ^ or ~ prefix, not an exact version`, () => {
        const raw = pkg.dependencies[dep];
        expect(raw, `${dep} exists in dependencies`).toBeDefined();
        expect(
          raw.startsWith('^') || raw.startsWith('~'),
          `${dep} is exact-pinned as "${raw}", should use ^ or ~`
        ).toBe(true);
      });
    }
  });

  describe('node-abi is not stale-pinned', () => {
    it('node-abi should use range prefix (^) not exact pin', () => {
      const raw = pkg.dependencies['node-abi'];
      expect(raw, 'node-abi exists in dependencies').toBeDefined();
      expect(
        raw.startsWith('^') || raw.startsWith('~'),
        `node-abi is exact-pinned as "${raw}", should use ^ or ~ for Electron ABI compat`
      ).toBe(true);
    });

    it('node-abi major version should be >= 3', () => {
      const raw = pkg.dependencies['node-abi'];
      expect(raw, 'node-abi exists').toBeDefined();
      const version = raw.replace(/^[^0-9]*/, '');
      const major = Number(version.split('.')[0]);
      expect(major, `node-abi major is ${major}, need >= 3 for Electron 42`).toBeGreaterThanOrEqual(3);
    });
  });

  describe('lockfileVersion is >= 2', () => {
    it('package-lock.json should exist', () => {
      expect(fs.existsSync(LOCK_PATH), 'package-lock.json exists').toBe(true);
    });

    it('lockfileVersion should be >= 2', () => {
      expect(lock.lockfileVersion, 'lockfileVersion is defined').toBeDefined();
      expect(
        lock.lockfileVersion,
        `lockfileVersion is ${lock.lockfileVersion}, need >= 2`
      ).toBeGreaterThanOrEqual(2);
    });
  });
});
