import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const GITIGNORE_PATH = path.resolve(ROOT, '.gitignore');
const NVMRC_PATH = path.resolve(ROOT, '.nvmrc');
const PACKAGE_JSON_PATH = path.resolve(ROOT, 'package.json');

// Load files synchronously at module level
const gitignoreContent = fs.readFileSync(GITIGNORE_PATH, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));

describe('Project Configuration Validation', () => {
  describe('.gitignore completeness', () => {
    const requiredEntries = ['.env', '.DS_Store', 'out/', '.vscode/', '*.swp'];

    for (const entry of requiredEntries) {
      it(`should contain "${entry}"`, () => {
        const lines = gitignoreContent.split('\n');
        expect(lines, `.gitignore should include "${entry}"`).toContain(entry);
      });
    }
  });

  describe('.nvmrc existence', () => {
    it('.nvmrc file should exist at project root', () => {
      expect(fs.existsSync(NVMRC_PATH), '.nvmrc file should exist').toBe(true);
    });
  });

  describe('package.json engines field', () => {
    it('should have an engines field', () => {
      expect(packageJson.engines, 'engines field should exist').toBeDefined();
    });

    it('should have a node engine constraint', () => {
      expect(packageJson.engines, 'engines field should exist').toBeDefined();
      expect(packageJson.engines.node, 'node engine constraint should exist').toBeDefined();
    });

    it('should have an npm engine constraint', () => {
      expect(packageJson.engines, 'engines field should exist').toBeDefined();
      expect(packageJson.engines.npm, 'npm engine constraint should exist').toBeDefined();
    });
  });
});
