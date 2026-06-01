import { describe, it, expect } from 'vitest'
import { TRUSTED_SHELL_DIRS, TRUSTED_WINDOWS_SHELLS, ALLOWED_SHELL_NAMES, isShellAllowed } from '../../src/main/security-constants.js'

// ============================================================
// These tests validate the shell allowlist logic now exported
// from src/main/security-constants.js.
// ============================================================

// Regex from ipc-terminal.js (param sanitization)
const METACHAR_REGEX = /[;&|`$(){}!<>~'"\\]/u
// oxlint-disable-next-line no-control-regex
const CONTROL_REGEX = /\u000a|\u000d|\u0009|\u0000|#/u

// Dangerous-flag check from ipc-terminal.js
const DANGEROUS_FLAG_REGEX = /^-[a-zA-Z]*[cC]$|^\/[cC]$|^--command([= ]|$)/

// ---- Metacharacter detection ----

describe('Shell parameter sanitization', () => {
  describe('Metacharacter detection', () => {
    it('rejects semicolon', () => {
      expect(METACHAR_REGEX.test('arg;malicious')).toBe(true)
    })

    it('rejects pipe', () => {
      expect(METACHAR_REGEX.test('arg|malicious')).toBe(true)
    })

    it('rejects backtick', () => {
      expect(METACHAR_REGEX.test('arg`whoami`')).toBe(true)
    })

    it('rejects dollar sign', () => {
      expect(METACHAR_REGEX.test('$HOME')).toBe(true)
    })

    it('rejects parentheses', () => {
      expect(METACHAR_REGEX.test('$(whoami)')).toBe(true)
    })

    it('rejects curly braces', () => {
      expect(METACHAR_REGEX.test('{a,b}')).toBe(true)
    })

    it('rejects newline', () => {
      expect(CONTROL_REGEX.test('arg\nmalicious')).toBe(true)
    })

    it('rejects carriage return', () => {
      expect(CONTROL_REGEX.test('arg\rmalicious')).toBe(true)
    })

    it('rejects tab', () => {
      expect(CONTROL_REGEX.test('arg\tmalicious')).toBe(true)
    })

    it('rejects null byte', () => {
      expect(CONTROL_REGEX.test('arg\u0000malicious')).toBe(true)
    })

    it('rejects hash', () => {
      expect(CONTROL_REGEX.test('foo#comment')).toBe(true)
    })

    it('rejects exclamation mark', () => {
      expect(METACHAR_REGEX.test('foo!bar')).toBe(true)
    })

    it('rejects angle brackets', () => {
      expect(METACHAR_REGEX.test('foo<bar')).toBe(true)
      expect(METACHAR_REGEX.test('foo>bar')).toBe(true)
    })

    it('rejects tilde expansion', () => {
      expect(METACHAR_REGEX.test('~user')).toBe(true)
    })

    it('rejects backslash', () => {
      expect(METACHAR_REGEX.test('foo\\bar')).toBe(true)
    })

    it('accepts normal flags', () => {
      expect(METACHAR_REGEX.test('--login')).toBe(false)
    })

    it('accepts -i flag', () => {
      expect(METACHAR_REGEX.test('-i')).toBe(false)
    })

    it('accepts --noediting', () => {
      expect(METACHAR_REGEX.test('--noediting')).toBe(false)
    })

    it('accepts plain word', () => {
      expect(METACHAR_REGEX.test('hello')).toBe(false)
    })

    it('accepts path-like argument without metachars', () => {
      expect(METACHAR_REGEX.test('/tmp/somefile')).toBe(false)
    })
  })

  // ---- Dangerous flag detection ----

  describe('Dangerous flag detection', () => {
    it('rejects -c', () => {
      expect(DANGEROUS_FLAG_REGEX.test('-c')).toBe(true)
    })

    it('rejects -C', () => {
      expect(DANGEROUS_FLAG_REGEX.test('-C')).toBe(true)
    })

    it('rejects /c (Windows cmd.exe)', () => {
      expect(DANGEROUS_FLAG_REGEX.test('/c')).toBe(true)
    })

    it('rejects /C (Windows)', () => {
      expect(DANGEROUS_FLAG_REGEX.test('/C')).toBe(true)
    })

    it('rejects --command (PowerShell)', () => {
      expect(DANGEROUS_FLAG_REGEX.test('--command')).toBe(true)
    })

    it('accepts --login', () => {
      expect(DANGEROUS_FLAG_REGEX.test('--login')).toBe(false)
    })

    it('accepts -i', () => {
      expect(DANGEROUS_FLAG_REGEX.test('-i')).toBe(false)
    })

    it('accepts --noediting', () => {
      expect(DANGEROUS_FLAG_REGEX.test('--noediting')).toBe(false)
    })

    it('accepts --norc', () => {
      expect(DANGEROUS_FLAG_REGEX.test('--norc')).toBe(false)
    })

    it('accepts -l', () => {
      expect(DANGEROUS_FLAG_REGEX.test('-l')).toBe(false)
    })
  })

  // ---- Directory-based shell allowlist ----

  describe('Shell directory allowlist', () => {
    it('accepts /bin/bash', () => {
      expect(isShellAllowed('/bin/bash')).toBe(true)
    })

    it('accepts /bin/sh', () => {
      expect(isShellAllowed('/bin/sh')).toBe(true)
    })

    it('accepts /bin/zsh', () => {
      expect(isShellAllowed('/bin/zsh')).toBe(true)
    })

    it('accepts /bin/fish', () => {
      expect(isShellAllowed('/bin/fish')).toBe(true)
    })

    it('accepts /usr/bin/bash', () => {
      expect(isShellAllowed('/usr/bin/bash')).toBe(true)
    })

    it('accepts /usr/bin/zsh', () => {
      expect(isShellAllowed('/usr/bin/zsh')).toBe(true)
    })

    it('accepts /usr/bin/fish', () => {
      expect(isShellAllowed('/usr/bin/fish')).toBe(true)
    })

    it('accepts /usr/local/bin/bash', () => {
      expect(isShellAllowed('/usr/local/bin/bash')).toBe(true)
    })

    it('accepts /usr/local/bin/zsh', () => {
      expect(isShellAllowed('/usr/local/bin/zsh')).toBe(true)
    })

    it('accepts /usr/local/bin/fish', () => {
      expect(isShellAllowed('/usr/local/bin/fish')).toBe(true)
    })

    it('accepts /opt/homebrew/bin/zsh (macOS Apple Silicon)', () => {
      expect(isShellAllowed('/opt/homebrew/bin/zsh')).toBe(true)
    })

    it('accepts /opt/homebrew/bin/bash', () => {
      expect(isShellAllowed('/opt/homebrew/bin/bash')).toBe(true)
    })

    it('accepts /run/current-system/sw/bin/bash (NixOS)', () => {
      expect(isShellAllowed('/run/current-system/sw/bin/bash')).toBe(true)
    })

    it('accepts /run/current-system/sw/bin/zsh (NixOS)', () => {
      expect(isShellAllowed('/run/current-system/sw/bin/zsh')).toBe(true)
    })

    it('accepts /run/current-system/sw/bin/fish (NixOS)', () => {
      expect(isShellAllowed('/run/current-system/sw/bin/fish')).toBe(true)
    })

    it('accepts /snap/bin/bash (Ubuntu snap)', () => {
      expect(isShellAllowed('/snap/bin/bash')).toBe(true)
    })

    it('accepts powershell.exe (Windows)', () => {
      expect(isShellAllowed('powershell.exe')).toBe(true)
    })

    it('accepts cmd.exe (Windows)', () => {
      expect(isShellAllowed('cmd.exe')).toBe(true)
    })

    it('accepts pwsh.exe (Windows)', () => {
      expect(isShellAllowed('pwsh.exe')).toBe(true)
    })

    // ---- Rejected paths ----

    it('rejects /tmp/evil-shell', () => {
      expect(isShellAllowed('/tmp/evil-shell')).toBe(false)
    })

    it('rejects /usr/sbin/bash (not in trusted dirs)', () => {
      expect(isShellAllowed('/usr/sbin/bash')).toBe(false)
    })

    it('rejects /opt/evil/bin/bash (opt but not homebrew)', () => {
      expect(isShellAllowed('/opt/evil/bin/bash')).toBe(false)
    })

    it('rejects /home/user/.local/bin/evil (not trusted)', () => {
      expect(isShellAllowed('/home/user/.local/bin/evil')).toBe(false)
    })

    it('rejects relative path', () => {
      expect(isShellAllowed('bash')).toBe(false)
    })

    it('rejects empty string', () => {
      expect(isShellAllowed('')).toBe(false)
    })

    // Nix multi-user store paths are NOT trusted by directory prefix
    it('rejects /nix/store/.../bin/bash (Nix store, too broad)', () => {
      expect(isShellAllowed('/nix/store/abc123-bash-5.2/bin/bash')).toBe(false)
    })

    // Ensure /bin/ prefix is exact, not matching /binary/...
    it('rejects /binary/something (not /bin/)', () => {
      expect(isShellAllowed('/binary/something')).toBe(false)
    })

    // Ensure /snap/bin/ is exact
    it('rejects /snap/evil/bash', () => {
      expect(isShellAllowed('/snap/evil/bash')).toBe(false)
    })
  })

describe('Actual code DANGEROUS_FLAG_REGEX edge cases', () => {
    // The FIXED regex from index.js:
    // /^-[a-zA-Z]*[cC]$|^\/[cC]$|^--command$/
    // Rejects -c, -C, -ac, -aC, --command, /c. Allows --check, --config, abc, music.
    const fixedRegex = /^-[a-zA-Z]*[cC]$|^\/[cC]$|^--command([= ]|$)/;

    it('does NOT reject --check', () => {
        expect(fixedRegex.test('--check')).toBe(false);
    });

    it('does NOT reject --config', () => {
        expect(fixedRegex.test('--config')).toBe(false);
    });

    it('does NOT reject --recursive', () => {
        expect(fixedRegex.test('--recursive')).toBe(false);
    });

    it('rejects -abc (combined flags include -c)', () => {
        expect(fixedRegex.test('-abc')).toBe(true);
    });

    it('STILL rejects -c', () => {
        expect(fixedRegex.test('-c')).toBe(true);
    });

    it('rejects -C (now fixed)', () => {
        expect(fixedRegex.test('-C')).toBe(true);
    });

    it('STILL rejects --command', () => {
        expect(fixedRegex.test('--command')).toBe(true);
    });

    it('STILL rejects /c', () => {
        expect(fixedRegex.test('/c')).toBe(true);
    });

    it('does NOT reject bare word "abc" (no dash prefix)', () => {
        expect(fixedRegex.test('abc')).toBe(false);
    });

    it('does NOT reject bare word "music"', () => {
        expect(fixedRegex.test('music')).toBe(false);
    });

    it('rejects -ac (combined flags ending in c)', () => {
        expect(fixedRegex.test('-ac')).toBe(true);
    });

    it('rejects -aC (combined flags ending in C)', () => {
        expect(fixedRegex.test('-aC')).toBe(true);
    });

    it('rejects /C (Windows uppercase)', () => {
        expect(fixedRegex.test('/C')).toBe(true);
    });
});

describe('--command prefix forms (defense-in-depth)', () => {
    // Updated production regex — catches --command= and --command (but NOT --commander)
    const fixedRegex = /^-[a-zA-Z]*[cC]$|^\/[cC]$|^--command([= ]|$)/;

    it('rejects --command=evil (equals form)', () => {
        expect(fixedRegex.test('--command=evil')).toBe(true);
    });

    it('rejects --command=anything (equals with any value)', () => {
        expect(fixedRegex.test('--command=anything')).toBe(true);
    });

    it('does NOT reject --commander (different flag)', () => {
        expect(fixedRegex.test('--commander')).toBe(false);
    });
});

describe('Shell name allowlist (defense-in-depth)', () => {
    const TRUSTED_SHELL_DIRS = [
        '/bin/', '/usr/bin/', '/usr/local/bin/',
        '/opt/homebrew/bin/',
        '/run/current-system/sw/bin/',
        '/snap/bin/',
    ];
    const TRUSTED_WINDOWS_SHELLS = ['powershell.exe', 'cmd.exe', 'pwsh.exe'];
    const ALLOWED_SHELL_NAMES = ['bash', 'sh', 'zsh', 'fish', 'powershell.exe', 'cmd.exe', 'pwsh.exe'];

    function isShellAllowed(resolvedPath) {
        const base = resolvedPath.split('/').pop().toLowerCase();
        if (TRUSTED_WINDOWS_SHELLS.includes(base)) return true;
        if (!TRUSTED_SHELL_DIRS.some(dir => resolvedPath.startsWith(dir))) return false;
        return ALLOWED_SHELL_NAMES.includes(base);
    }

    it('accepts /bin/bash', () => {
        expect(isShellAllowed('/bin/bash')).toBe(true);
    });

    it('accepts /usr/bin/zsh', () => {
        expect(isShellAllowed('/usr/bin/zsh')).toBe(true);
    });

    it('rejects /bin/evil-binary (unknown binary in trusted dir)', () => {
        expect(isShellAllowed('/bin/evil-binary')).toBe(false);
    });

    it('rejects /usr/bin/malware', () => {
        expect(isShellAllowed('/usr/bin/malware')).toBe(false);
    });
});
})
