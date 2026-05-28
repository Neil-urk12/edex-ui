import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('main.js indentation hygiene', () => {
  const mainJs = readFileSync(join(__dirname, '../src/renderer/main.js'), 'utf-8');
  const lines = mainJs.split('\n');

  it('try/catch blocks have consistent indentation', () => {
    const issues = [];
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1];
      const curr = lines[i];
      const prevIndent = prev.match(/^(\s*)/)[1].length;
      const currIndent = curr.match(/^(\s*)/)[1].length;
      const currTrimmed = curr.trim();
      
      // Detect } catch at wrong indent level (should match the try's indent)
      if (currTrimmed.startsWith('} catch') && prevIndent < currIndent) {
        issues.push(`Line ${i + 1}: } catch indented ${currIndent} spaces but previous line at ${prevIndent}`);
      }
    }
    expect(issues).toEqual([]);
  });

  it('all } catch blocks align with their try', () => {
    const issues = [];
    let tryIndent = -1;
    for (let i = 0; i < lines.length; i++) {
      const indent = lines[i].match(/^(\s*)/)[1].length;
      const trimmed = lines[i].trim();
      if (trimmed === 'try {') {
        tryIndent = indent;
      } else if (trimmed.startsWith('} catch') && tryIndent >= 0) {
        if (indent !== tryIndent) {
          issues.push(`Line ${i + 1}: } catch at ${indent} spaces, try at ${tryIndent}`);
        }
        tryIndent = -1;
      }
    }
    expect(issues).toEqual([]);
  });
});
