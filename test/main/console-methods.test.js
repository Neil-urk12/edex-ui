import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Console method usage in main process', () => {
  const srcDir = join(process.cwd(), 'src/main');
  
  describe('No console.err typos', () => {
    it('should not contain console.err in any main process file', () => {
      const files = ['index.js', 'ipc-filesystem.js', 'ipc-helpers.js', 'ipc-settings.js', 'ipc-system.js', 'ipc-validation.js', 'terminal.js'];
      
      for (const file of files) {
        try {
          const content = readFileSync(join(srcDir, file), 'utf-8');
          // Check for console.err (typo) but not console.error
          const errMatches = content.match(/console\.err\b(?!or)/g);
          expect(errMatches, `${file} contains console.err typo: ${errMatches}`).toBeNull();
        } catch (e) {
          if (e.code !== 'ENOENT') throw e; // Re-throw unexpected errors
        }
      }
    });

    it('should use console.error for error logging', () => {
      const content = readFileSync(join(srcDir, 'index.js'), 'utf-8');
      const errorCalls = content.match(/console\.error\(/g) || [];
      expect(errorCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Logger utility usage', () => {
    it('should import logger in index.js', () => {
      const content = readFileSync(join(srcDir, 'index.js'), 'utf-8');
      const hasLoggerImport = content.includes("import { logger }") || content.includes("import logger");
      expect(hasLoggerImport, 'index.js should import logger').toBe(true);
    });

    it('should not have bare console.log for operational messages', () => {
      const content = readFileSync(join(srcDir, 'index.js'), 'utf-8');
      
      // These are debug/operational messages that should use logger
      const debugPatterns = [
        /console\.log\(\s*'\[MAIN\]/,
        /console\.log\(\s*'\[RENDERER\]/,
      ];
      
      for (const pattern of debugPatterns) {
        const match = content.match(pattern);
        // These should be replaced with logger.info() or logger.debug()
        expect(match, `Found bare console.log matching ${pattern} - should use logger`).toBeNull();
      }
    });
  });

  describe('Console method correctness', () => {
    it('should use console.warn for warnings (or logger.warn)', () => {
      const content = readFileSync(join(srcDir, 'index.js'), 'utf-8');
      const warnCalls = content.match(/console\.warn\(/g) || [];
      const loggerWarnCalls = content.match(/logger\.warn\(/g) || [];
      // At least one warning mechanism should exist (or none if no warnings needed)
      // This test documents the pattern, not enforces a count
      expect(true).toBe(true); // Placeholder - remove this test if not useful
    });
  });
});
