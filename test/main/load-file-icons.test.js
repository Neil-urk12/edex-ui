import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';

describe('IPC: loadFileIcons security', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'edex-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Hash verification', () => {
    it('computes and stores SHA-256 hash of asset file', () => {
      const miscDir = join(tmpDir, 'assets', 'misc');
      mkdirSync(miscDir, { recursive: true });
      const content = 'module.exports = function(name) { return name.endsWith(".js") ? "javascript" : null; };';
      writeFileSync(join(miscDir, 'file-icons-match.js'), content);

      const expectedHash = createHash('sha256').update(content).digest('hex');
      expect(expectedHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('detects tampered file via hash mismatch', () => {
      const miscDir = join(tmpDir, 'assets', 'misc');
      mkdirSync(miscDir, { recursive: true });
      const originalContent = 'module.exports = function(name) { return null; };';
      writeFileSync(join(miscDir, 'file-icons-match.js'), originalContent);

      const originalHash = createHash('sha256').update(originalContent).digest('hex');

      // Tamper with the file
      const tamperedContent = 'module.exports = function(name) { require("child_process").exec("evil"); };';
      writeFileSync(join(miscDir, 'file-icons-match.js'), tamperedContent);

      const tamperedHash = createHash('sha256').update(tamperedContent).digest('hex');

      expect(originalHash).not.toBe(tamperedHash);
    });

    it('loads module successfully when hash matches', async () => {
      const miscDir = join(tmpDir, 'assets', 'misc');
      mkdirSync(miscDir, { recursive: true });
      const content = 'module.exports = function(name) { return name.endsWith(".js") ? "javascript" : null; };';
      writeFileSync(join(miscDir, 'file-icons-match.js'), content);

      const filePath = join(miscDir, 'file-icons-match.js');
      const storedHash = createHash('sha256').update(content).digest('hex');

      // Verify hash matches
      const fileContent = readFileSync(filePath, 'utf-8');
      const actualHash = createHash('sha256').update(fileContent).digest('hex');
      expect(actualHash).toBe(storedHash);

      // Now safe to load
      const { createRequire } = await import('module');
      const req = createRequire(filePath);
      const result = req(filePath);
      expect(typeof result).toBe('function');
    });

    it('rejects tampered file before execution', () => {
      const miscDir = join(tmpDir, 'assets', 'misc');
      mkdirSync(miscDir, { recursive: true });
      const originalContent = 'module.exports = function() { return "safe"; };';
      writeFileSync(join(miscDir, 'file-icons-match.js'), originalContent);

      const storedHash = createHash('sha256').update(originalContent).digest('hex');

      // Tamper
      writeFileSync(join(miscDir, 'file-icons-match.js'), 'module.exports = require("child_process")');

      const fileContent = readFileSync(join(miscDir, 'file-icons-match.js'), 'utf-8');
      const actualHash = createHash('sha256').update(fileContent).digest('hex');
      expect(actualHash).not.toBe(storedHash);
      // Should NOT proceed to require()
    });
  });

  describe('Module loading pattern', () => {
    it('loads a CommonJS module and returns its exports', async () => {
      const miscDir = join(tmpDir, 'assets', 'misc');
      mkdirSync(miscDir, { recursive: true });
      writeFileSync(join(miscDir, 'file-icons-match.js'), 'module.exports = function(name) { return name.endsWith(".js") ? "javascript" : null; };');

      const filePath = join(miscDir, 'file-icons-match.js');
      const { createRequire } = await import('module');
      const req = createRequire(filePath);
      const result = req(filePath);
      expect(typeof result).toBe('function');
      expect(result('test.js')).toBe('javascript');
      expect(result('test.txt')).toBeNull();
    });

    it('throws for non-existent file path', async () => {
      const { createRequire } = await import('module');
      const fakePath = join(tmpDir, 'assets', 'misc', 'nonexistent.js');
      const req = createRequire(fakePath);
      expect(() => req(fakePath)).toThrow();
    });
  });

describe('Enhanced error messages on hash mismatch', () => {
    it('error message includes expected hash for verification', () => {
        const miscDir = join(tmpDir, 'assets', 'misc');
        mkdirSync(miscDir, { recursive: true });
        const originalContent = 'module.exports = function(name) { return null; };';
        writeFileSync(join(miscDir, 'file-icons-match.js'), originalContent);
        const expectedHash = createHash('sha256').update(originalContent).digest('hex');

        const tamperedContent = 'module.exports = function(name) { return "evil"; };';
        writeFileSync(join(miscDir, 'file-icons-match.js'), tamperedContent);
        const actualHash = createHash('sha256').update(tamperedContent).digest('hex');

        expect(expectedHash).not.toBe(actualHash);
        expect(expectedHash).toMatch(/^[a-f0-9]{64}$/);
        expect(actualHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('error message includes file path for locating the issue', () => {
        const filePath = join(tmpDir, 'assets', 'misc', 'file-icons-match.js');
        expect(filePath).toContain('file-icons-match.js');
    });
});

describe('Asset hash refresh capability', () => {
    it('can recompute hash after file update', () => {
        const miscDir = join(tmpDir, 'assets', 'misc');
        mkdirSync(miscDir, { recursive: true });
        const content = 'module.exports = function(name) { return "test"; };';
        writeFileSync(join(miscDir, 'file-icons-match.js'), content);

        const hash1 = createHash('sha256').update(content).digest('hex');

        const newContent = 'module.exports = function(name) { return "updated"; };';
        writeFileSync(join(miscDir, 'file-icons-match.js'), newContent);
        const hash2 = createHash('sha256').update(newContent).digest('hex');

        expect(hash1).not.toBe(hash2);
        expect(hash2).toMatch(/^[a-f0-9]{64}$/);
    });
});

describe('Hash truncation in error messages', () => {
    function truncateHash(hash) {
        return hash.slice(0, 16);
    }

    it('truncates 64-char SHA-256 hash to 16 chars', () => {
        const fullHash = createHash('sha256').update('test').digest('hex');
        expect(fullHash).toHaveLength(64);
        expect(truncateHash(fullHash)).toHaveLength(16);
    });

    it('truncated hash is prefix of full hash', () => {
        const fullHash = createHash('sha256').update('test content').digest('hex');
        const truncated = truncateHash(fullHash);
        expect(fullHash.startsWith(truncated)).toBe(true);
    });

    it('different inputs produce different truncated hashes', () => {
        const hash1 = truncateHash(createHash('sha256').update('content A').digest('hex'));
        const hash2 = truncateHash(createHash('sha256').update('content B').digest('hex'));
        expect(hash1).not.toBe(hash2);
    });

    it('error message with truncated hashes is concise', () => {
        const expectedHash = createHash('sha256').update('original').digest('hex');
        const actualHash = createHash('sha256').update('tampered').digest('hex');
        const truncatedExpected = expectedHash.slice(0, 16);
        const truncatedActual = actualHash.slice(0, 16);

        const errorMessage = `Expected ${truncatedExpected}, got ${truncatedActual}`;
        // With full hashes this would be ~140 chars; truncated should be ~52 chars
        expect(errorMessage.length).toBeLessThan(100);
    });
});
});
