// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ramwatcherPath = resolve(__dirname, '../../src/renderer/classes/ramwatcher.class.js');

describe('RAMwatcher GiB constant', () => {
    const BYTES_PER_GIB = 2 ** 30; // 1073741824

    it('defines BYTES_PER_GIB as 2^30 (1073741824)', () => {
        expect(BYTES_PER_GIB).toBe(1073741824);
    });

    it('source uses correct GiB constant (1073741824), not wrong value (1073742000)', () => {
        const src = readFileSync(ramwatcherPath, 'utf-8');
        // The incorrect value that should NOT appear
        expect(src).not.toContain('1073742000');
        // The correct value (2^30) should appear
        expect(src).toContain('1073741824');
    });

    it('source does not contain any hardcoded wrong GiB divisor', () => {
        const src = readFileSync(ramwatcherPath, 'utf-8');
        // Extract all numeric literals that look like they could be GiB divisors
        // (numbers close to 1 billion)
        const largeNumbers = src.match(/\b10[0-9]{8,9}\b/g) || [];
        for (const num of largeNumbers) {
            const val = parseInt(num, 10);
            // If it's close to GiB range, it must be exactly 2^30
            if (val > 1_000_000_000 && val < 1_100_000_000) {
                expect(val).toBe(BYTES_PER_GIB);
            }
        }
    });

    it('GiB conversion with correct constant produces accurate results', () => {
        // 1 GiB = 1073741824 bytes
        const oneGiB = BYTES_PER_GIB;
        const result = Math.round((oneGiB / BYTES_PER_GIB) * 10) / 10;
        expect(result).toBe(1.0);
    });

    it('GiB conversion with wrong constant (1073742000) would produce inaccurate results', () => {
        // This test documents WHY the fix matters:
        // With the wrong constant, 1 GiB of data would display as ~1.000000166 GiB
        const wrongConstant = 1073742000;
        const oneGiB = BYTES_PER_GIB;
        const wrongResult = oneGiB / wrongConstant;
        const correctResult = oneGiB / BYTES_PER_GIB;
        // The wrong constant produces a value != 1.0
        expect(wrongResult).not.toBe(correctResult);
        // Error accumulates at scale: 64 GiB would be off by ~0.00001 GiB
        const errorAt64GiB = Math.abs((64 * BYTES_PER_GIB / wrongConstant) - 64);
        expect(errorAt64GiB).toBeGreaterThan(0);
    });
});
