import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const OXLINT_CONFIG_PATH = path.resolve(ROOT, '.oxlintrc.json');
const PRETTIER_CONFIG_PATH = path.resolve(ROOT, '.prettierrc');
const PACKAGE_JSON_PATH = path.resolve(ROOT, 'package.json');

let oxlintContent = null;
let prettierContent = null;
let pkgJson = null;

// Load oxlint config (may not exist yet)
try {
  oxlintContent = fs.readFileSync(OXLINT_CONFIG_PATH, 'utf8');
} catch {
  // .oxlintrc.json does not exist yet
}

// Load prettier config (may not exist yet)
try {
  prettierContent = fs.readFileSync(PRETTIER_CONFIG_PATH, 'utf8');
} catch {
  // .prettierrc does not exist yet
}

// Load package.json
try {
  pkgJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
} catch {
  // package.json missing
}

describe('Lint Config Validation', () => {
  describe('Test 1: oxlint config exists', () => {
    it('.oxlintrc.json should exist at project root', () => {
      expect(
        fs.existsSync(OXLINT_CONFIG_PATH),
        '.oxlintrc.json should exist'
      ).toBe(true);
    });
  });

  describe('Test 2: oxlint config contains required rules', () => {
    it('should contain no-unused-vars rule', () => {
      expect(oxlintContent, '.oxlintrc.json should be readable').not.toBeNull();
      expect(oxlintContent, 'config should reference no-unused-vars').toContain('no-unused-vars');
    });

    it('should contain no-console rule', () => {
      expect(oxlintContent, '.oxlintrc.json should be readable').not.toBeNull();
      expect(oxlintContent, 'config should reference no-console').toContain('no-console');
    });

    it('should contain eqeqeq rule', () => {
      expect(oxlintContent, '.oxlintrc.json should be readable').not.toBeNull();
      expect(oxlintContent, 'config should reference eqeqeq').toContain('eqeqeq');
    });
  });

  describe('Test 3: Prettier config exists', () => {
    it('.prettierrc should exist at project root', () => {
      expect(
        fs.existsSync(PRETTIER_CONFIG_PATH),
        '.prettierrc should exist'
      ).toBe(true);
    });
  });

  describe('Test 4: Prettier config is valid JSON with required fields', () => {
    it('.prettierrc should be valid JSON', () => {
      expect(prettierContent, '.prettierrc should be readable').not.toBeNull();
      const parsed = JSON.parse(prettierContent);
      expect(parsed, '.prettierrc should parse as JSON').toBeDefined();
    });

    it('should have semi field', () => {
      expect(prettierContent, '.prettierrc should be readable').not.toBeNull();
      const parsed = JSON.parse(prettierContent);
      expect(parsed.semi, '.prettierrc should have semi field').toBeDefined();
    });

    it('should have singleQuote field', () => {
      expect(prettierContent, '.prettierrc should be readable').not.toBeNull();
      const parsed = JSON.parse(prettierContent);
      expect(parsed.singleQuote, '.prettierrc should have singleQuote field').toBeDefined();
    });
  });

  describe('Test 5: oxlint is a devDependency', () => {
    it('package.json should list oxlint in devDependencies', () => {
      expect(pkgJson, 'package.json should be readable').not.toBeNull();
      expect(pkgJson.devDependencies, 'devDependencies exists').toBeDefined();
      expect(pkgJson.devDependencies.oxlint, 'oxlint is in devDependencies').toBeDefined();
    });
  });

  describe('Test 6: prettier is a devDependency', () => {
    it('package.json should list prettier in devDependencies', () => {
      expect(pkgJson, 'package.json should be readable').not.toBeNull();
      expect(pkgJson.devDependencies, 'devDependencies exists').toBeDefined();
      expect(pkgJson.devDependencies.prettier, 'prettier is in devDependencies').toBeDefined();
    });
  });

  describe('Test 7: lint script uses oxlint', () => {
    it('package.json scripts should include lint', () => {
      expect(pkgJson, 'package.json should be readable').not.toBeNull();
      expect(pkgJson.scripts, 'scripts exists').toBeDefined();
      expect(pkgJson.scripts.lint, 'lint script exists').toBeDefined();
    });

    it('lint script should use oxlint', () => {
      expect(pkgJson.scripts.lint, 'lint script should use oxlint').toContain('oxlint');
    });
  });

  describe('Test 8: format script exists', () => {
    it('package.json scripts should include format', () => {
      expect(pkgJson, 'package.json should be readable').not.toBeNull();
      expect(pkgJson.scripts, 'scripts exists').toBeDefined();
      expect(pkgJson.scripts.format, 'format script exists').toBeDefined();
    });
  });
});
