import { TerminalSession } from './terminal.js'
import { validateWithin } from './ipc-validation.js'
import { isShellAllowed } from './security-constants.js'
import { sendToMainWindow } from './ipc-helpers.js'
import which from 'which'
import shellEnv from 'shell-env'

const terminals = new Map()
let nextTerminalId = 0

export function register(ipcMain, { userData, settingsFile, defaultSettings, readJsonFile, app, getWindow }) {
  ipcMain.handle('terminal:create', async (_event, options) => {
    const settings = readJsonFile(settingsFile, { ...defaultSettings })
    let cleanEnv
    try {
      cleanEnv = await shellEnv(settings.shell)
    } catch {
      cleanEnv = { ...process.env }
    }
    Object.assign(cleanEnv, {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'eDEX-UI',
      TERM_PROGRAM_VERSION: app.getVersion()
    })

    const requestedShell = options.shell || settings.shell;
    const resolvedShell = await which(requestedShell).catch(() => null);
    let shell = settings.shell;
    if (resolvedShell && isShellAllowed(resolvedShell)) {
      shell = resolvedShell;
    } else {
      const fallbackResolved = await which(settings.shell).catch(() => null);
      if (fallbackResolved && isShellAllowed(fallbackResolved)) {
        shell = fallbackResolved;
      } else {
        throw new Error('No allowed shell available: both requested and configured shells failed allowlist validation');
      }
    }

    // Sanitize params - reject shell metacharacters and dangerous flags
    const rawParams = options.params || settings.shellArgs || [];
    for (const p of rawParams) {
      // oxlint-disable-next-line no-control-regex — intentional for shell injection prevention
      if (typeof p !== 'string' || /[;&|`$(){}!<>~'"\\]/u.test(p) || /\u000a|\u000d|\u0009|\u0000|#/u.test(p)) {
        throw new Error('Invalid shell parameter: contains forbidden characters');
      }
      if (/^-[a-zA-Z]*[cC]$|^\/[cC]$|^--command([= ]|$)/.test(p)) {
        throw new Error('Invalid shell parameter: -c flag not allowed');
      }
    }
    const params = rawParams;
    const id = nextTerminalId++
    const session = new TerminalSession({
      id,
      shell,
      params,
      cwd: options.cwd ? validateWithin(options.cwd, userData) : settings.cwd,
      env: cleanEnv,
      ondata: (_id, data) => {
        sendToMainWindow(getWindow(), 'terminal:data', { id, data })
      },
      onexit: (_id, exitCode, signal) => {
        terminals.delete(id)
        sendToMainWindow(getWindow(), 'terminal:exit', { id, exitCode, signal })
      },
      oncwd: (_id, cwd) => {
        sendToMainWindow(getWindow(), 'terminal:cwd-changed', { id, cwd })
      },
      onprocess: (_id, proc) => {
        sendToMainWindow(getWindow(), 'terminal:process-changed', { id, process: proc })
      }
    })
    terminals.set(id, session)
    return id
  })

  ipcMain.on('terminal:write', (_event, { id, data }) => {
    const session = terminals.get(id)
    if (session) session.write(data)
  })

  ipcMain.on('terminal:resize', (_event, { id, cols, rows }) => {
    const session = terminals.get(id)
    if (session) session.resize(cols, rows)
  })

  ipcMain.handle('terminal:kill', (_event, id) => {
    const session = terminals.get(id)
    if (session) {
      session.kill()
      terminals.delete(id)
    }
  })
}

export function killAllTerminals() {
  for (const [, session] of terminals) {
    try { session.kill() } catch (e) { console.warn('[before-quit] Failed to kill terminal session:', e.message) }
  }
}
