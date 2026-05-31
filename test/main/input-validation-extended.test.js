import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateFilename, validateAndResolve, validateWithin, validateAssetPath } from '../../src/main/ipc-validation.js';
import { mkdirSync, writeFileSync, symlinkSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Input Validation - Extended', () => {
  let testDir;

  beforeEach(() => {
    testDir = join(tmpdir(), `edex-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, 'allowed'), { recursive: true });
    writeFileSync(join(testDir, 'allowed', 'test.txt'), 'test');
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('validateFilename', () => {
    describe('Path traversal prevention', () => {
      it('should reject path traversal with ../', () => {
        expect(() => validateFilename('../etc/passwd')).toThrow('Invalid path');
      });

      it('should reject path traversal with ..\\', () => {
        expect(() => validateFilename('..\\etc\\passwd')).toThrow('Invalid path');
      });

      it('should reject path traversal with /../', () => {
        expect(() => validateFilename('dir/../etc/passwd')).toThrow('Invalid path');
      });

      it('should reject path traversal with \\..\\', () => {
        expect(() => validateFilename('dir\\..\\etc\\passwd')).toThrow('Invalid path');
      });

      it('should reject path traversal ending with /..', () => {
        expect(() => validateFilename('dir/..')).toThrow('Invalid path');
      });

      it('should reject path traversal ending with \\..', () => {
        expect(() => validateFilename('dir\\..')).toThrow('Invalid path');
      });

      it('should reject just ..', () => {
        expect(() => validateFilename('..')).toThrow('Invalid path');
      });
    });

    describe('URL-encoded path traversal prevention', () => {
      it('should reject URL-encoded path traversal %2e%2e', () => {
        expect(() => validateFilename('%2e%2e/etc/passwd')).toThrow('Invalid path');
      });

      it('should reject double URL-encoded path traversal', () => {
        expect(() => validateFilename('%252e%252e/etc/passwd')).toThrow('Invalid path');
      });

      it('should reject URL-encoded path separator %2f', () => {
        expect(() => validateFilename('file%2fname')).toThrow('Invalid path');
      });

      it('should reject URL-encoded path separator %2F', () => {
        expect(() => validateFilename('file%2Fname')).toThrow('Invalid path');
      });

      it('should reject URL-encoded backslash %5c', () => {
        expect(() => validateFilename('file%5cname')).toThrow('Invalid path');
      });

      it('should reject URL-encoded backslash %5C', () => {
        expect(() => validateFilename('file%5Cname')).toThrow('Invalid path');
      });
    });

    describe('Null byte injection prevention', () => {
      it('should reject null bytes', () => {
        expect(() => validateFilename('file\0name')).toThrow('Invalid path');
      });

      it('should reject URL-encoded null bytes %00', () => {
        expect(() => validateFilename('file%00name')).toThrow('Invalid path');
      });

      it('should reject URL-encoded null bytes %00 in path', () => {
        expect(() => validateFilename('file%00.txt')).toThrow('Invalid path');
      });
    });

    describe('Absolute path prevention', () => {
      it('should reject Unix absolute paths', () => {
        expect(() => validateFilename('/etc/passwd')).toThrow('Invalid path');
      });

      it('should reject Windows absolute paths', () => {
        expect(() => validateFilename('C:\\Windows\\System32')).toThrow('Invalid path');
      });
    });

    describe('Valid filename acceptance', () => {
      it('should accept simple filenames', () => {
        expect(() => validateFilename('test.txt')).not.toThrow();
      });

      it('should accept filenames with spaces', () => {
        expect(() => validateFilename('my file.txt')).not.toThrow();
      });

      it('should accept filenames with dots', () => {
        expect(() => validateFilename('file.name.txt')).not.toThrow();
      });

      it('should accept filenames with hyphens', () => {
        expect(() => validateFilename('my-file.txt')).not.toThrow();
      });

      it('should accept filenames with underscores', () => {
        expect(() => validateFilename('my_file.txt')).not.toThrow();
      });

      it('should accept Unicode filenames', () => {
        expect(() => validateFilename('文件.txt')).not.toThrow();
      });
    });

    describe('Edge cases', () => {
      it('should reject empty strings', () => {
        expect(() => validateFilename('')).toThrow('Invalid path');
      });

      it('should reject whitespace-only strings', () => {
        expect(() => validateFilename('   ')).toThrow('Invalid path');
      });

      it('should reject non-string inputs', () => {
        expect(() => validateFilename(123)).toThrow('Invalid path');
        expect(() => validateFilename(null)).toThrow('Invalid path');
        expect(() => validateFilename(undefined)).toThrow('Invalid path');
      });
    });
  });

  describe('validateWithin', () => {
    it('should accept paths within allowed directory', () => {
      const allowedDir = join(testDir, 'allowed');
      const filePath = join(allowedDir, 'test.txt');
      expect(() => validateWithin(filePath, allowedDir)).not.toThrow();
    });

    it('should reject paths outside allowed directory', () => {
      const allowedDir = join(testDir, 'allowed');
      const filePath = join(testDir, 'outside.txt');
      expect(() => validateWithin(filePath, allowedDir)).toThrow('Access denied');
    });

    it('should reject traversal that escapes allowed directory', () => {
      const allowedDir = join(testDir, 'allowed');
      const filePath = join(allowedDir, '..', 'outside.txt');
      expect(() => validateWithin(filePath, allowedDir)).toThrow('Access denied');
    });
  });

  describe('validateAssetPath', () => {
    it('should reject traversal in asset paths', () => {
      expect(() => validateAssetPath('../config.json', testDir)).toThrow();
    });

    it('should reject absolute paths', () => {
      expect(() => validateAssetPath('/etc/passwd', testDir)).toThrow();
    });

    it('should accept valid asset paths', () => {
      // Create assets directory structure
      const assetsDir = join(testDir, 'assets');
      mkdirSync(assetsDir, { recursive: true });
      mkdirSync(join(assetsDir, 'themes'), { recursive: true });
      writeFileSync(join(assetsDir, 'themes', 'default.json'), '{}');
      
      expect(() => validateAssetPath('themes/default.json', testDir)).not.toThrow();
    });

    it('should reject UNC paths (\\\\server\\share)', () => {
      expect(() => validateAssetPath('\\\\server\\share\\file.txt', testDir)).toThrow();
    });

    it('should reject bare UNC paths', () => {
      expect(() => validateAssetPath('\\\\server\\share', testDir)).toThrow();
    });
  });

  describe('Symlink escape prevention', () => {
    it('should reject symlinks that escape allowed directory', () => {
      const allowedDir = join(testDir, 'allowed');
      const symlinkPath = join(allowedDir, 'escape-link');
      const targetPath = join(testDir, 'outside.txt');
      
      writeFileSync(targetPath, 'outside');
      
      try {
        symlinkSync(targetPath, symlinkPath);
        expect(() => validateWithin(symlinkPath, allowedDir)).toThrow('Access denied');
      } catch (e) {
        // Symlink creation may fail on some systems, skip test
        if (e.code !== 'EPERM') throw e;
      }
    });
  });
});
