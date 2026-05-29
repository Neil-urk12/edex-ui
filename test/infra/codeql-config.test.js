import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const CODEQL_CONFIG_PATH = path.resolve(process.cwd(), '.github/workflows/codeql-analysis.yml');

let config;

// Load and parse CodeQL config
try {
  const content = fs.readFileSync(CODEQL_CONFIG_PATH, 'utf8');
  config = yaml.load(content);
} catch (error) {
  throw new Error(`Failed to load CodeQL config from ${CODEQL_CONFIG_PATH}: ${error.message}`);
}

describe('CodeQL Workflow Config Validation', () => {
  describe('codeql-action uses @v3', () => {
    it('codeql-action/init should use @v3', () => {
      const steps = config.jobs.analyze.steps;
      const initStep = steps.find(step => step.uses && step.uses.includes('codeql-action/init'));
      expect(initStep, 'codeql-action/init step exists').toBeDefined();
      expect(initStep.uses, 'codeql-action/init should be @v3').toMatch(/@v3$/);
    });

    it('codeql-action/autobuild should use @v3', () => {
      const steps = config.jobs.analyze.steps;
      const autobuildStep = steps.find(step => step.uses && step.uses.includes('codeql-action/autobuild'));
      expect(autobuildStep, 'codeql-action/autobuild step exists').toBeDefined();
      expect(autobuildStep.uses, 'codeql-action/autobuild should be @v3').toMatch(/@v3$/);
    });

    it('codeql-action/analyze should use @v3', () => {
      const steps = config.jobs.analyze.steps;
      const analyzeStep = steps.find(step => step.uses && step.uses.includes('codeql-action/analyze'));
      expect(analyzeStep, 'codeql-action/analyze step exists').toBeDefined();
      expect(analyzeStep.uses, 'codeql-action/analyze should be @v3').toMatch(/@v3$/);
    });
  });

  describe('actions/checkout uses @v4', () => {
    it('checkout action should be @v4', () => {
      const steps = config.jobs.analyze.steps;
      const checkoutStep = steps.find(step => step.uses && step.uses.includes('actions/checkout'));
      expect(checkoutStep, 'checkout step exists').toBeDefined();
      expect(checkoutStep.uses, 'actions/checkout should be @v4').toMatch(/@v4$/);
    });
  });

  describe('branches reference master', () => {
    it('push branches should include master', () => {
      expect(config.on.push, 'push trigger exists').toBeDefined();
      expect(config.on.push.branches, 'push branches exist').toBeDefined();
      expect(config.on.push.branches, 'push branches should include master').toContain('master');
    });

    it('pull_request branches should include master', () => {
      expect(config.on.pull_request, 'pull_request trigger exists').toBeDefined();
      expect(config.on.pull_request.branches, 'pull_request branches exist').toBeDefined();
      expect(config.on.pull_request.branches, 'pull_request branches should include master').toContain('master');
    });

    it('push branches should not reference feat/electron33-migration', () => {
      expect(config.on.push.branches).not.toContain('feat/electron33-migration');
    });

    it('pull_request branches should not reference feat/electron33-migration', () => {
      expect(config.on.pull_request.branches).not.toContain('feat/electron33-migration');
    });
  });

  describe('workflow_dispatch trigger', () => {
    it('should have workflow_dispatch in the on trigger', () => {
      expect(config.on, 'on trigger exists').toBeDefined();
      expect(config.on.workflow_dispatch, 'workflow_dispatch trigger exists').toBeDefined();
    });
  });
});
