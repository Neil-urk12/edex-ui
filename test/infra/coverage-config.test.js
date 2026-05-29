import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const VITEST_CONFIG_PATH = path.resolve(process.cwd(), 'vitest.config.js');
let content;

// Load vitest config as text
try {
  content = fs.readFileSync(VITEST_CONFIG_PATH, 'utf8');
} catch (error) {
  throw new Error(`Failed to load vitest config from ${VITEST_CONFIG_PATH}: ${error.message}`);
}

describe('Vitest Coverage Config Validation', () => {
  describe('Test 1: Coverage section exists', () => {
    it('vitest.config.js should contain a coverage configuration', () => {
      expect(content, 'coverage section should exist').toContain('coverage');
    });
  });

  describe('Test 2: Coverage provider is v8', () => {
    it('coverage provider should be set to v8', () => {
      expect(content, 'provider should be v8').toMatch(/provider\s*:\s*['"]v8['"]/);
    });
  });

  describe('Test 3: Coverage reporter includes text and html', () => {
    it('coverage reporter should include text', () => {
      expect(content, 'reporter should include text').toMatch(/reporter\s*:\s*\[[^\]]*'text'/);
    });

    it('coverage reporter should include html', () => {
      expect(content, 'reporter should include html').toMatch(/reporter\s*:\s*\[[^\]]*'html'/);
    });
  });

  describe('Test 4: Coverage include patterns', () => {
    it('coverage include should contain src/**/*.js', () => {
      expect(content, 'include should contain src/**/*.js').toContain('src/**/*.js');
    });
  });

  describe('Test 5: Coverage exclude patterns', () => {
    it('coverage exclude should contain src/assets/vendor/**', () => {
      expect(content, 'exclude should contain src/assets/vendor/**').toContain('src/assets/vendor/**');
    });

    it('coverage exclude should contain src/assets/misc/file-icons-match.js', () => {
      expect(content, 'exclude should contain file-icons-match').toContain('src/assets/misc/file-icons-match.js');
    });
  });

  describe('Test 6: Coverage thresholds lines >= 40', () => {
    it('coverage thresholds should exist', () => {
      expect(content, 'thresholds should exist').toMatch(/thresholds\s*:/);
    });

    it('coverage thresholds lines should be at least 40', () => {
      const thresholdsMatch = content.match(/thresholds\s*:\s*\{([^}]+)\}/);
      expect(thresholdsMatch, 'thresholds block should be parseable').not.toBeNull();

      const linesMatch = thresholdsMatch[1].match(/lines\s*:\s*(\d+)/);
      expect(linesMatch, 'lines threshold should be defined').not.toBeNull();
      expect(Number(linesMatch[1]), 'lines threshold should be >= 40').toBeGreaterThanOrEqual(40);
    });
  });

  describe('Test 7: @vitest/coverage-v8 is a devDependency', () => {
    it('package.json should list @vitest/coverage-v8 in devDependencies', () => {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.devDependencies, 'devDependencies exists').toBeDefined();
      expect(pkg.devDependencies['@vitest/coverage-v8'], '@vitest/coverage-v8 is in devDependencies').toBeDefined();
    });
  });
});
