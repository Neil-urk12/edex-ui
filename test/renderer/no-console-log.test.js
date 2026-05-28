import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Production console hygiene', () => {
  const mainJs = readFileSync(join(__dirname, '../../src/renderer/main.js'), 'utf-8');

  it('main.js has no console.log calls', () => {
    const lines = mainJs.split('\n');
    const logLines = lines.filter(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
      return /console\.log\(/.test(line);
    });
    expect(logLines).toEqual([]);
  });

  it('main.js retains console.warn and console.error for diagnostics', () => {
    expect(mainJs).toMatch(/console\.(warn|error)/);
  });
});

describe('Renderer class files have no console.log', () => {
  const classesDir = join(__dirname, '../../src/renderer/classes');
  const vendorFiles = ['encom-globe.js'];

  const classFiles = readdirSync(classesDir)
    .filter(f => f.endsWith('.js') && !vendorFiles.includes(f));

  for (const file of classFiles) {
    it(`${file} has no console.log calls`, () => {
      const content = readFileSync(join(classesDir, file), 'utf-8');
      const lines = content.split('\n');
      const logLines = lines.filter(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
        return /console\.log\(/.test(line);
      });
      expect(logLines).toEqual([]);
    });
  }
});
