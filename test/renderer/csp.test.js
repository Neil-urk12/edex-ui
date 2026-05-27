// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Content Security Policy', () => {
  let cspContent;

  beforeAll(() => {
    const html = readFileSync(resolve('src/renderer/index.html'), 'utf-8');
    const match = html.match(/content="([^"]*?)"/);
    cspContent = match ? match[1] : '';
  });

  function getDirective(name) {
    const match = cspContent.match(new RegExp(name + '\\s+([^;]+)'));
    return match ? match[1].trim() : null;
  }

  describe('script-src', () => {
    it('does not allow unsafe-eval', () => {
      expect(cspContent).not.toContain("'unsafe-eval'");
    });

    it("contains 'self'", () => {
      const val = getDirective('script-src');
      expect(val).toContain("'self'");
    });

    it("contains 'unsafe-inline' (required for Electron)", () => {
      const val = getDirective('script-src');
      expect(val).toContain("'unsafe-inline'");
    });
  });

  describe('default-src', () => {
    it("is 'self'", () => {
      const val = getDirective('default-src');
      expect(val).toBe("'self'");
    });
  });

  describe('style-src', () => {
    it("allows 'self' and 'unsafe-inline'", () => {
      const val = getDirective('style-src');
      expect(val).toBeTruthy();
      expect(val).toContain("'self'");
      expect(val).toContain("'unsafe-inline'");
    });
  });

  describe('img-src', () => {
    it("allows 'self' and data: URIs", () => {
      const val = getDirective('img-src');
      expect(val).toBeTruthy();
      expect(val).toContain("'self'");
      expect(val).toContain('data:');
    });
  });

  describe('font-src', () => {
    it("allows 'self' and blob:", () => {
      const val = getDirective('font-src');
      expect(val).toBeTruthy();
      expect(val).toContain("'self'");
      expect(val).toContain('blob:');
    });
  });

  describe('connect-src', () => {
    it("allows 'self' and edex-audio: protocol", () => {
      const val = getDirective('connect-src');
      expect(val).toBeTruthy();
      expect(val).toContain("'self'");
      expect(val).toContain('edex-audio:');
    });
  });

  describe('media-src', () => {
    it("allows 'self' and edex-audio: protocol", () => {
      const val = getDirective('media-src');
      expect(val).toBeTruthy();
      expect(val).toContain("'self'");
      expect(val).toContain('edex-audio:');
    });
  });

  describe('object-src', () => {
    it("is 'none' (blocks plugins)", () => {
      const val = getDirective('object-src');
      expect(val).toBe("'none'");
    });
  });

  describe('base-uri', () => {
    it("restricts to 'self'", () => {
      const val = getDirective('base-uri');
      expect(val).toBe("'self'");
    });
  });

  describe('form-action', () => {
    it("restricts to 'self'", () => {
      const val = getDirective('form-action');
      expect(val).toBe("'self'");
    });
  });
});
