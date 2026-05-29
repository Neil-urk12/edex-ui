// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';

describe('getPlatform', () => {
  const originalUAData = navigator.userAgentData;
  const originalPlatform = navigator.platform;

  afterEach(() => {
    // Restore originals
    Object.defineProperty(navigator, 'userAgentData', { value: originalUAData, configurable: true });
    Object.defineProperty(navigator, 'platform', { value: originalPlatform, configurable: true });
  });

  it('is NOT exported from utils.js', async () => {
    const mod = await import('../../src/renderer/utils.js');
    expect(mod.getPlatform).toBeUndefined();
  });

  it('is NOT set on window', async () => {
    await import('../../src/renderer/utils.js');
    expect(window._getPlatform).toBeUndefined();
  });
});
