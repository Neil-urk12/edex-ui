import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Package.json install scripts', () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

  it('install-linux references @electron/rebuild (not legacy electron-rebuild)', () => {
    expect(pkg.scripts['install-linux']).toContain('@electron');
    expect(pkg.scripts['install-linux']).toMatch(/@electron.rebuild/);
  });

  it('install-windows references @electron/rebuild (not legacy electron-rebuild)', () => {
    expect(pkg.scripts['install-windows']).toContain('@electron');
    expect(pkg.scripts['install-windows']).toMatch(/@electron.rebuild/);
  });
});
