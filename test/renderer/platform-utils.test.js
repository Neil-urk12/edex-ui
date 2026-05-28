// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('getPlatform', () => {
  const originalUAData = navigator.userAgentData;
  const originalPlatform = navigator.platform;

  afterEach(() => {
    // Restore originals
    Object.defineProperty(navigator, 'userAgentData', { value: originalUAData, configurable: true });
    Object.defineProperty(navigator, 'platform', { value: originalPlatform, configurable: true });
  });

  it('is exported as a regular function (not async)', async () => {
    const { getPlatform } = await import('../../src/renderer/utils.js');
    expect(typeof getPlatform).toBe('function');
    // Should return a string directly, not a Promise
    const result = getPlatform();
    expect(typeof result).toBe('string');
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('returns one of win32, darwin, linux', async () => {
    const { getPlatform } = await import('../../src/renderer/utils.js');
    const result = getPlatform();
    expect(['win32', 'darwin', 'linux']).toContain(result);
  });

  it('uses userAgentData.platform when available', async () => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: { platform: 'Windows' },
      configurable: true,
    });
    const { getPlatform } = await import('../../src/renderer/utils.js');
    expect(getPlatform()).toBe('win32');
  });

  it('detects macOS via userAgentData', async () => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: { platform: 'macOS' },
      configurable: true,
    });
    const { getPlatform } = await import('../../src/renderer/utils.js');
    expect(getPlatform()).toBe('darwin');
  });

  it('detects Linux via userAgentData', async () => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: { platform: 'Linux' },
      configurable: true,
    });
    const { getPlatform } = await import('../../src/renderer/utils.js');
    expect(getPlatform()).toBe('linux');
  });

  it('falls back to navigator.platform when userAgentData is undefined', async () => {
    Object.defineProperty(navigator, 'userAgentData', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    const { getPlatform } = await import('../../src/renderer/utils.js');
    expect(getPlatform()).toBe('win32');
  });

  it('falls back to linux when both are empty/undefined', async () => {
    Object.defineProperty(navigator, 'userAgentData', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'platform', { value: '', configurable: true });
    const { getPlatform } = await import('../../src/renderer/utils.js');
    expect(getPlatform()).toBe('linux');
  });
});
