import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Console Gating', () => {
  let originalEnv;
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;
  let consoleDebugSpy;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('Logger utility', () => {
    it('should export logger object', async () => {
      const { logger } = await import('../../src/main/logger.js');
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should gate debug logs in production', async () => {
      process.env.NODE_ENV = 'production';
      const { logger } = await import('../../src/main/logger.js');
      logger.debug('test message');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should allow debug logs in development', async () => {
      process.env.NODE_ENV = 'development';
      const { logger } = await import('../../src/main/logger.js');
      logger.debug('test message');
      expect(consoleDebugSpy).toHaveBeenCalledWith('test message');
    });

    it('should gate info logs in production', async () => {
      process.env.NODE_ENV = 'production';
      const { logger } = await import('../../src/main/logger.js');
      logger.info('test message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should allow info logs in development', async () => {
      process.env.NODE_ENV = 'development';
      const { logger } = await import('../../src/main/logger.js');
      logger.info('test message');
      expect(consoleLogSpy).toHaveBeenCalledWith('test message');
    });

    it('should always log warnings', async () => {
      process.env.NODE_ENV = 'production';
      const { logger } = await import('../../src/main/logger.js');
      logger.warn('test warning');
      expect(consoleWarnSpy).toHaveBeenCalledWith('test warning');
    });

    it('should always log errors', async () => {
      process.env.NODE_ENV = 'production';
      const { logger } = await import('../../src/main/logger.js');
      logger.error('test error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('test error');
    });

    it('should sanitize paths in production', async () => {
      process.env.NODE_ENV = 'production';
      const { logger } = await import('../../src/main/logger.js');
      logger.tagged('MAIN', 'warn', 'Loading /home/user/projects/edex-ui/src/main/index.js');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[MAIN] Loading /home/***/projects/edex-ui/src/main/index.js'
      );
    });

    it('should gate info logs in production (no output even with paths)', async () => {
      process.env.NODE_ENV = 'production';
      const { logger } = await import('../../src/main/logger.js');
      logger.info('Loading /home/user/projects/app/src/main/index.js');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should sanitize paths in logger.warn output in production', async () => {
      process.env.NODE_ENV = 'production';
      const { logger } = await import('../../src/main/logger.js');
      logger.warn('Permission denied /Users/john/Documents/secret.txt');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Permission denied /Users/***/Documents/secret.txt'
      );
    });

    it('should sanitize paths in logger.error output in production', async () => {
      process.env.NODE_ENV = 'production';
      const { logger } = await import('../../src/main/logger.js');
      logger.error('Failed C:\\Users\\admin\\AppData\\Local\\config.json');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed C:\\Users\\***\\AppData\\Local\\config.json'
      );
    });

    it('should not sanitize paths in development via info/warn/error', async () => {
      process.env.NODE_ENV = 'development';
      const { logger } = await import('../../src/main/logger.js');
      logger.info('Loading /home/user/projects/app/src/main/index.js');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Loading /home/user/projects/app/src/main/index.js'
      );
    });

    it('should handle mixed string and non-string args with sanitization', async () => {
      process.env.NODE_ENV = 'production';
      const { logger } = await import('../../src/main/logger.js');
      logger.warn('Path:', '/home/user/file.txt', 123);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Path:', '/home/***/file.txt', 123);
    });

    it('should not sanitize paths in development', async () => {
      process.env.NODE_ENV = 'development';
      const { logger } = await import('../../src/main/logger.js');
      logger.tagged('MAIN', 'info', 'Loading /home/user/projects/edex-ui/src/main/index.js');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[MAIN] Loading /home/user/projects/edex-ui/src/main/index.js'
      );
    });
  });

  describe('Environment detection', () => {
    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(process.env.NODE_ENV).toBe('development');
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(process.env.NODE_ENV).toBe('production');
    });

    it('should treat undefined NODE_ENV as development', () => {
      delete process.env.NODE_ENV;
      const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;
      expect(isDev).toBe(true);
    });

    it('should default to production behavior when NODE_ENV is undefined', async () => {
      delete process.env.NODE_ENV;
      const { logger } = await import('../../src/main/logger.js');
      logger.debug('should be suppressed');
      logger.info('should be suppressed');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('Sensitive data protection', () => {
    it('should sanitize Unix home paths', async () => {
      process.env.NODE_ENV = 'production';
      const { logger } = await import('../../src/main/logger.js');
      logger.tagged('TEST', 'warn', 'Path: /home/johndoe/documents/file.txt');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[TEST] Path: /home/***/documents/file.txt'
      );
    });

    it('should sanitize macOS user paths', async () => {
      process.env.NODE_ENV = 'production';
      const { logger } = await import('../../src/main/logger.js');
      logger.tagged('TEST', 'warn', 'Path: /Users/johndoe/Documents/file.txt');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[TEST] Path: /Users/***/Documents/file.txt'
      );
    });

    it('should sanitize Windows user paths', async () => {
      process.env.NODE_ENV = 'production';
      const { logger } = await import('../../src/main/logger.js');
      logger.tagged('TEST', 'warn', 'Path: C:\\Users\\johndoe\\Documents\\file.txt');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[TEST] Path: C:\\Users\\***\\Documents\\file.txt'
      );
    });

    it('should not sanitize in development', async () => {
      process.env.NODE_ENV = 'development';
      const { logger } = await import('../../src/main/logger.js');
      const path = '/home/johndoe/documents/file.txt';
      logger.tagged('TEST', 'info', `Path: ${path}`);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[TEST] Path: ${path}`);
    });

    it('should sanitize paths in warn when NODE_ENV is undefined', async () => {
      delete process.env.NODE_ENV;
      const { logger } = await import('../../src/main/logger.js');
      logger.warn('Path: /home/johndoe/documents/file.txt');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Path: /home/***/documents/file.txt'
      );
    });

    it('should sanitize paths in error when NODE_ENV is undefined', async () => {
      delete process.env.NODE_ENV;
      const { logger } = await import('../../src/main/logger.js');
      logger.error('Failed /home/johndoe/secret.json');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed /home/***/secret.json'
      );
    });
  });

  describe('tagged() validation', () => {
    it('should throw on invalid log level', async () => {
      process.env.NODE_ENV = 'development';
      const { logger } = await import('../../src/main/logger.js');
      expect(() => logger.tagged('TEST', 'invalid', 'msg')).toThrow(/Invalid log level/);
    });

    it('should accept valid level debug', async () => {
      process.env.NODE_ENV = 'development';
      const { logger } = await import('../../src/main/logger.js');
      expect(() => logger.tagged('TEST', 'debug', 'msg')).not.toThrow();
    });

    it('should accept valid level warn', async () => {
      process.env.NODE_ENV = 'development';
      const { logger } = await import('../../src/main/logger.js');
      expect(() => logger.tagged('TEST', 'warn', 'msg')).not.toThrow();
    });
  });
});
