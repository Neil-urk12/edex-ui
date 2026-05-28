// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('utils.js named exports (keep)', () => {
  it('exports escapeHtml', async () => {
    const mod = await import('../../src/renderer/utils.js');
    expect(typeof mod.escapeHtml).toBe('function');
  });

  it('exports encodePathURI', async () => {
    const mod = await import('../../src/renderer/utils.js');
    expect(typeof mod.encodePathURI).toBe('function');
  });

  it('exports purifyCSS', async () => {
    const mod = await import('../../src/renderer/utils.js');
    expect(typeof mod.purifyCSS).toBe('function');
  });

  it('exports delay', async () => {
    const mod = await import('../../src/renderer/utils.js');
    expect(typeof mod.delay).toBe('function');
  });
});

describe('utils.js _-prefixed export guard', () => {
  it('has no _-prefixed exports', async () => {
    const mod = await import('../../src/renderer/utils.js');
    const underscoreExports = Object.keys(mod).filter(k => k.startsWith('_'));
    expect(underscoreExports).toEqual([]);
  });

  it('does not set any window._* globals', async () => {
    await import('../../src/renderer/utils.js');
    const windowUnderscoreKeys = Object.keys(window).filter(k => k.startsWith('_') && !k.startsWith('__'));
    expect(windowUnderscoreKeys).toEqual([]);
  });
});

describe('utils.js getPlatform removal', () => {
  it('does NOT export getPlatform', async () => {
    const mod = await import('../../src/renderer/utils.js');
    expect(mod.getPlatform).toBeUndefined();
  });
});


describe('filesystem.class.js import cleanup', () => {
  it('imports escapeHtml (not _escapeHtml) from utils', async () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      resolve(__dirname, '../../src/renderer/classes/filesystem.class.js'),
      'utf-8'
    );
    const firstLine = src.split('\n')[0];
    // Should import plain names, not _-prefixed
    expect(firstLine).toMatch(/import\s*\{[^}]*escapeHtml/);
    expect(firstLine).not.toMatch(/_escapeHtml/);
    expect(firstLine).not.toMatch(/_encodePathURI/);
    expect(firstLine).not.toMatch(/_delay/);
  });
});

describe('purifyCSS security', () => {
  it('strips < to prevent HTML injection', async () => {
    const { purifyCSS } = await import('../../src/renderer/utils.js');
    const input = '<script>alert(1)</script>';
    const result = purifyCSS(input);
    expect(result).not.toContain('<');
  });

  it('preserves CSS syntax characters for injectCSS support', async () => {
    const { purifyCSS } = await import('../../src/renderer/utils.js');
    const input = 'body { color: red; } .foo { background: url(test) }';
    const result = purifyCSS(input);
    expect(result).toContain('{');
    expect(result).toContain('}');
    expect(result).toContain(';');
  });

  it('preserves valid CSS color values', async () => {
    const { purifyCSS } = await import('../../src/renderer/utils.js');
    expect(purifyCSS('#ff0000')).toBe('#ff0000');
  });

  it('preserves valid CSS rgb values', async () => {
    const { purifyCSS } = await import('../../src/renderer/utils.js');
    expect(purifyCSS('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
  });

  it('handles undefined input', async () => {
    const { purifyCSS } = await import('../../src/renderer/utils.js');
    expect(purifyCSS(undefined)).toBe('');
  });
});
