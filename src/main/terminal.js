import * as pty from 'node-pty'
import { platform } from 'os'
import { readlink } from 'fs'
import { execSync } from 'child_process'

/**
 * Manages a single PTY session. Data flows via IPC, not WebSocket.
 */
export class TerminalSession {
  constructor({ id, shell, params, cwd, env, ondata, onexit, oncwd, onprocess }) {
    this.id = id
    this._closed = false
    this._cwd = cwd
    this._process = ''
    this._disableCWDtracking = false

    this._ondata = ondata
    this._onexit = onexit
    this._oncwd = oncwd
    this._onprocess = onprocess

    this._pty = pty.spawn(shell, params, {
      name: env.TERM || 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd || process.env.PWD,
      env: env || process.env
    })

    this._pty.onData(data => {
      this._tickCWD = true
      this._tickProcess = true
      if (this._ondata) this._ondata(this.id, data)
    })

    this._pty.onExit(({ exitCode, signal }) => {
      this._closed = true
      this._stopPolling()
      if (this._onexit) this._onexit(this.id, exitCode, signal)
    })

    // Poll CWD and subprocess every 1s
    this._tickCWD = false
    this._tickProcess = false
    this._interval = setInterval(() => this._tick(), 1000)
  }

  get pid() {
    return this._pty ? this._pty.pid : null
  }

  get cwd() {
    return this._cwd
  }

  write(data) {
    if (!this._closed && this._pty) {
      this._pty.write(data)
    }
  }

  resize(cols, rows) {
    if (!this._closed && this._pty) {
      try {
        this._pty.resize(cols, rows)
      } catch {
        // ignore resize errors on dead PTY
      }
    }
  }

  kill() {
    if (!this._closed && this._pty) {
      this._closed = true
      this._stopPolling()
      this._pty.kill()
    }
  }

  _stopPolling() {
    if (this._interval) {
      clearInterval(this._interval)
      this._interval = null
    }
  }

  _tick() {
    if (this._closed) return

    if (this._tickCWD && !this._disableCWDtracking) {
      this._tickCWD = false
      this._getCWD().then(cwd => {
        if (cwd && cwd !== this._cwd) {
          this._cwd = cwd
          if (this._oncwd) this._oncwd(this.id, cwd)
        }
      }).catch(() => {
        // Fallback: disable CWD tracking if unsupported
        this._disableCWDtracking = true
      })
    }

    if (this._tickProcess) {
      this._tickProcess = false
      this._getProcess().then(proc => {
        if (proc && proc !== this._process) {
          this._process = proc
          if (this._onprocess) this._onprocess(this.id, proc)
        }
      }).catch(() => {
        // ignore
      })
    }
  }

  _getCWD() {
    const pid = this._pty.pid
    if (!Number.isInteger(pid) || pid <= 0) {
      return Promise.reject(new Error('Invalid PID'));
    }
    const osType = platform()

    return new Promise((resolve, reject) => {
      if (osType === 'Linux') {
        readlink(`/proc/${pid}/cwd`, (err, cwd) => {
          if (err) reject(err)
          else resolve(cwd)
        })
      } else if (osType === 'Darwin') {
        try {
          const out = execSync(
            `lsof -a -d cwd -p ${pid} | tail -1 | awk '{ for (i=9; i<=NF; i++) printf "%s ", $i }'`,
            { encoding: 'utf-8', timeout: 2000 }
          )
          resolve(out.trim())
        } catch (e) {
          reject(e)
        }
      } else {
        reject(new Error('Unsupported OS'))
      }
    })
  }

  _getProcess() {
    const pid = this._pty.pid
    if (!Number.isInteger(pid) || pid <= 0) {
      return Promise.resolve('unknown');
    }
    const osType = platform()

    return new Promise((resolve, reject) => {
      if (osType === 'Linux' || osType === 'Darwin') {
        try {
          const out = execSync(
            `ps -o comm --no-headers --sort=+pid -g ${pid} | tail -1`,
            { encoding: 'utf-8', timeout: 2000 }
          )
          resolve(out.trim())
        } catch (e) {
          reject(e)
        }
      } else {
        reject(new Error('Unsupported OS'))
      }
    })
  }
}
