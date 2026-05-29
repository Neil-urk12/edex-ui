import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const CI_CONFIG_PATH = path.resolve(process.cwd(), '.github/workflows/build-binaries.yaml');

let config;

// Load and parse CI config
try {
  const content = fs.readFileSync(CI_CONFIG_PATH, 'utf8');
  config = yaml.load(content);
} catch (error) {
  throw new Error(`Failed to load CI config from ${CI_CONFIG_PATH}: ${error.message}`);
}

describe('CI Config Validation', () => {
  describe('Test 1: Node version is 20', () => {
    it('build-linux job should use Node 20', () => {
      const steps = config.jobs['build-linux'].steps;
      const nodeStep = steps.find(step => step.uses && step.uses.includes('setup-node'));
      expect(nodeStep, 'setup-node step exists').toBeDefined();
      expect(nodeStep.with['node-version'], 'Node version is 20').toBe(20);
    });

    it('build-windows job should use Node 20', () => {
      const steps = config.jobs['build-windows'].steps;
      const nodeStep = steps.find(step => step.uses && step.uses.includes('setup-node'));
      expect(nodeStep, 'setup-node step exists').toBeDefined();
      expect(nodeStep.with['node-version'], 'Node version is 20').toBe(20);
    });

    it('build-darwin job should use Node 20', () => {
      const steps = config.jobs['build-darwin'].steps;
      const nodeStep = steps.find(step => step.uses && step.uses.includes('setup-node'));
      expect(nodeStep, 'setup-node step exists').toBeDefined();
      expect(nodeStep.with['node-version'], 'Node version is 20').toBe(20);
    });

    it('build-linux-arm32 job should use Node 20', () => {
      const steps = config.jobs['build-linux-arm32'].steps;
      const nodeStep = steps.find(step => step.uses && step.uses.includes('setup-node'));
      expect(nodeStep, 'setup-node step exists').toBeDefined();
      expect(nodeStep.with['node-version'], 'Node version is 20').toBe(20);
    });

    it('build-linux-arm64 job should use Node 20', () => {
      const steps = config.jobs['build-linux-arm64'].steps;
      const nodeStep = steps.find(step => step.uses && step.uses.includes('setup-node'));
      expect(nodeStep, 'setup-node step exists').toBeDefined();
      expect(nodeStep.with['node-version'], 'Node version is 20').toBe(20);
    });
  });

  describe('Test 2: GitHub Actions use v4', () => {
    it('all checkout actions should be @v4', () => {
      const jobs = Object.entries(config.jobs);
      for (const [jobName, job] of jobs) {
        const checkoutSteps = job.steps.filter(step => step.uses && step.uses.includes('checkout'));
        for (const step of checkoutSteps) {
          expect(step.uses, `checkout in ${jobName} should be @v4`).toMatch(/@v4$/);
        }
      }
    });

    it('all cache actions should be @v4', () => {
      const jobs = Object.entries(config.jobs);
      for (const [jobName, job] of jobs) {
        const cacheSteps = job.steps.filter(step => step.uses && step.uses.includes('actions/cache'));
        for (const step of cacheSteps) {
          expect(step.uses, `cache in ${jobName} should be @v4`).toMatch(/@v4$/);
        }
      }
    });

    it('all upload-artifact actions should be @v4', () => {
      const jobs = Object.entries(config.jobs);
      for (const [jobName, job] of jobs) {
        const uploadSteps = job.steps.filter(step => step.uses && step.uses.includes('upload-artifact'));
        for (const step of uploadSteps) {
          expect(step.uses, `upload-artifact in ${jobName} should be @v4`).toMatch(/@v4$/);
        }
      }
    });

    it('all setup-node actions should be @v4', () => {
      const jobs = Object.entries(config.jobs);
      for (const [jobName, job] of jobs) {
        const setupNodeSteps = job.steps.filter(step => step.uses && step.uses.includes('setup-node'));
        for (const step of setupNodeSteps) {
          expect(step.uses, `setup-node in ${jobName} should be @v4`).toMatch(/@v4$/);
        }
      }
    });

    it('all docker/setup-qemu-action should be @v3', () => {
      const jobs = Object.entries(config.jobs);
      for (const [jobName, job] of jobs) {
        const qemuSteps = job.steps.filter(step => step.uses && step.uses.includes('docker/setup-qemu-action'));
        for (const step of qemuSteps) {
          expect(step.uses, `docker/setup-qemu-action in ${jobName} should be @v3`).toMatch(/@v3$/);
        }
      }
    });
  });

  describe('Test 3: Test step exists before build step', () => {
    it('build-linux job should have test:unit step before build', () => {
      const steps = config.jobs['build-linux'].steps;
      const testStepIndex = steps.findIndex(step => step.run && step.run.includes('npm run test:unit'));
      const buildStepIndex = steps.findIndex(step => step.run && step.run.includes('electron-builder'));

      expect(testStepIndex, 'test:unit step exists').toBeGreaterThanOrEqual(0);
      expect(buildStepIndex, 'build step exists').toBeGreaterThanOrEqual(0);
      expect(testStepIndex, 'test step comes before build step').toBeLessThan(buildStepIndex);
    });

    it('build-windows job should have test:unit step before build', () => {
      const steps = config.jobs['build-windows'].steps;
      const testStepIndex = steps.findIndex(step => step.run && step.run.includes('npm run test:unit'));
      const buildStepIndex = steps.findIndex(step => step.run && step.run.includes('build-windows'));

      expect(testStepIndex, 'test:unit step exists').toBeGreaterThanOrEqual(0);
      expect(buildStepIndex, 'build step exists').toBeGreaterThanOrEqual(0);
      expect(testStepIndex, 'test step comes before build step').toBeLessThan(buildStepIndex);
    });

    it('build-darwin job should have test:unit step before build', () => {
      const steps = config.jobs['build-darwin'].steps;
      const testStepIndex = steps.findIndex(step => step.run && step.run.includes('npm run test:unit'));
      const buildStepIndex = steps.findIndex(step => step.run && step.run.includes('build-darwin'));

      expect(testStepIndex, 'test:unit step exists').toBeGreaterThanOrEqual(0);
      expect(buildStepIndex, 'build step exists').toBeGreaterThanOrEqual(0);
      expect(testStepIndex, 'test step comes before build step').toBeLessThan(buildStepIndex);
    });
  });

  describe('Test 4: npm ci runs before test:unit in all jobs', () => {
    const jobs = Object.entries(config.jobs);

    for (const [jobName, job] of jobs) {
      it(`${jobName} should run npm ci before test:unit`, () => {
        const steps = job.steps;

        const npmCiIndex = steps.findIndex(
          step =>
            (step.run && step.run.includes('npm ci')) ||
            (step.with && step.with.args && step.with.args.includes('npm ci'))
        );

        const testUnitIndex = steps.findIndex(
          step => step.run && step.run.includes('npm run test:unit')
        );

        expect(npmCiIndex, `${jobName}: npm ci step should exist`).toBeGreaterThanOrEqual(0);
        expect(testUnitIndex, `${jobName}: test:unit step should exist`).toBeGreaterThanOrEqual(0);
        expect(npmCiIndex, `${jobName}: npm ci should come before test:unit`).toBeLessThan(testUnitIndex);
      });
    }
  });

  describe('Test 5: Docker images use Node 20', () => {
    it('build-linux-arm32 job should use node:20-bookworm', () => {
      const steps = config.jobs['build-linux-arm32'].steps;
      const dockerSteps = steps.filter(step => step.uses && step.uses.includes('docker://'));

      expect(dockerSteps.length, 'docker steps exist').toBeGreaterThan(0);
      for (const step of dockerSteps) {
        expect(step.uses, 'docker image should use node:20-bookworm').toMatch(/node:20-bookworm/);
      }
    });

    it('build-linux-arm64 job should use node:20-bookworm', () => {
      const steps = config.jobs['build-linux-arm64'].steps;
      const dockerSteps = steps.filter(step => step.uses && step.uses.includes('docker://'));

      expect(dockerSteps.length, 'docker steps exist').toBeGreaterThan(0);
      for (const step of dockerSteps) {
        expect(step.uses, 'docker image should use node:20-bookworm').toMatch(/node:20-bookworm/);
      }
    });
  });

  describe('Test 6: No npm@7 install', () => {
    it('no step should run "npm i -g npm@7" in build-linux', () => {
      const steps = config.jobs['build-linux'].steps;
      const npm7Steps = steps.filter(step => step.run && step.run.includes('npm@7'));

      expect(npm7Steps.length, 'no npm@7 install steps should exist').toBe(0);
    });

    it('no step should run "npm i -g npm@7" in build-linux-arm32', () => {
      const steps = config.jobs['build-linux-arm32'].steps;
      const npm7InRun = steps.filter(step => step.run && step.run.includes('npm@7'));
      const npm7InArgs = steps.filter(step => step.with && step.with.args && step.with.args.includes('npm@7'));

      expect([...npm7InRun, ...npm7InArgs].length, 'no npm@7 install steps should exist').toBe(0);
    });

    it('no step should run "npm i -g npm@7" in build-linux-arm64', () => {
      const steps = config.jobs['build-linux-arm64'].steps;
      const npm7InRun = steps.filter(step => step.run && step.run.includes('npm@7'));
      const npm7InArgs = steps.filter(step => step.with && step.with.args && step.with.args.includes('npm@7'));

      expect([...npm7InRun, ...npm7InArgs].length, 'no npm@7 install steps should exist').toBe(0);
    });

    it('no step should run "npm i -g npm@7" in build-windows', () => {
      const steps = config.jobs['build-windows'].steps;
      const npm7Steps = steps.filter(step => step.run && step.run.includes('npm@7'));

      expect(npm7Steps.length, 'no npm@7 install steps should exist').toBe(0);
    });

    it('no step should run "npm i -g npm@7" in build-darwin', () => {
      const steps = config.jobs['build-darwin'].steps;
      const npm7Steps = steps.filter(step => step.run && step.run.includes('npm@7'));

      expect(npm7Steps.length, 'no npm@7 install steps should exist').toBe(0);
    });
  });

  describe('Test 7: js-yaml is a direct devDependency', () => {
    it('package.json should list js-yaml in devDependencies', () => {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.devDependencies, 'devDependencies exists').toBeDefined();
      expect(pkg.devDependencies['js-yaml'], 'js-yaml is in devDependencies').toBeDefined();
    });
  });

  describe('Test 8: Workflow has workflow_dispatch trigger', () => {
    it('should have workflow_dispatch in the on trigger', () => {
      expect(config.on, 'on trigger exists').toBeDefined();
      expect(config.on.workflow_dispatch, 'workflow_dispatch trigger exists').toBeDefined();
    });
  });

  describe('Test 9: Permissions block exists', () => {
    it('should have permissions block', () => {
      expect(config.permissions, 'permissions block exists').toBeDefined();
    });

    it('should have contents: read permission', () => {
      expect(config.permissions.contents, 'contents permission is read').toBe('read');
    });
  });

  describe('Test 10: Concurrency block exists', () => {
    it('should have concurrency block', () => {
      expect(config.concurrency, 'concurrency block exists').toBeDefined();
    });

    it('should have cancel-in-progress', () => {
      expect(config.concurrency['cancel-in-progress'], 'cancel-in-progress exists').toBeDefined();
    });

    it('should have a group template', () => {
      expect(config.concurrency.group, 'concurrency group exists').toBeDefined();
      expect(config.concurrency.group, 'group references workflow').toContain('github.workflow');
    });
  });

  describe('Test 11: Tag trigger uses v* pattern', () => {
    it('should have push trigger with tags', () => {
      expect(config.on.push, 'push trigger exists').toBeDefined();
      expect(config.on.push.tags, 'tags filter exists').toBeDefined();
    });

    it('should use v* pattern for tags', () => {
      expect(config.on.push.tags, 'tags should use v* pattern').toContain('v*');
    });
  });
});
