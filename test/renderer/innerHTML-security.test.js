// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

describe('innerHTML Security', () => {
  describe('escapeHtml utility', () => {
    it('should escape HTML special characters', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('should escape ampersands', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should escape quotes', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      expect(escapeHtml('"double" and \'single\'')).toBe(
        '&quot;double&quot; and &#039;single&#039;'
      );
    });

    it('should handle null/undefined', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should convert non-strings to strings', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      expect(escapeHtml(123)).toBe('123');
      expect(escapeHtml(true)).toBe('true');
    });

    it('should return safe strings unchanged', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('Filesystem display security', () => {
    it('should escape malicious file names in render output', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      const maliciousName = '<img src=x onerror=alert(1)>';
      const escaped = escapeHtml(maliciousName);
      expect(escaped).not.toContain('<img');
      expect(escaped).toContain('&lt;img');
    });

    it('should escape file names with script tags', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      const maliciousName = '<script>document.cookie</script>';
      const escaped = escapeHtml(maliciousName);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
    });

    it('should escape paths with HTML entities', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      const pathWithHtml = '/home/user/<b>bold</b>/file.txt';
      const escaped = escapeHtml(pathWithHtml);
      expect(escaped).not.toContain('<b>');
      expect(escaped).toContain('&lt;b&gt;');
    });

    it('should escape file names with event handlers', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      const maliciousName = 'file" onload="alert(1)';
      const escaped = escapeHtml(maliciousName);
      expect(escaped).not.toContain('" onload="');
      expect(escaped).toContain('&quot;');
    });
  });

  describe('User display name security', () => {
    it('should escape usernames with HTML', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      const maliciousUser = '<script>alert("xss")</script>';
      const escaped = escapeHtml(maliciousUser);
      expect(escaped).not.toContain('<script>');
    });

    it('should escape usernames with special characters', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      const user = 'user&name';
      const escaped = escapeHtml(user);
      expect(escaped).toBe('user&amp;name');
    });
  });

  describe('Keyboard layout name security', () => {
    it('should escape keyboard layout names with HTML', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      const maliciousLayout = 'en-US<script>alert(1)</script>';
      const escaped = escapeHtml(maliciousLayout);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
    });
  });

  describe('Theme name security', () => {
    it('should escape theme names with HTML', async () => {
      const { escapeHtml } = await import('../../src/renderer/utils.js');
      const maliciousTheme = 'tron"><img src=x onerror=alert(1)>';
      const escaped = escapeHtml(maliciousTheme);
      expect(escaped).not.toContain('<img');
      expect(escaped).toContain('&lt;img');
    });
  });

  describe('eval() disabled', () => {
    it('should throw error when eval is called', async () => {
      await import('../../src/renderer/utils.js');
      expect(() => window.eval('1+1')).toThrow('eval() is disabled for security reasons.');
    });
  });
});
