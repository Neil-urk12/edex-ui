import { join, resolve, relative, isAbsolute, dirname, basename } from 'path'
import { realpathSync } from 'fs'

/**
 * Validate a filename/string for IPC handlers.
 * Rejects non-strings, null bytes, and path traversal via '..'
 */
export function validateFilename(name) {
  if (typeof name !== 'string' || name.trim() === '') throw new Error('Invalid path')
  // Reject null bytes (literal and URL-encoded)
  if (name.includes('\u0000') || /%00/i.test(name)) throw new Error('Invalid path')
  // Reject URL-encoded path separators (defense-in-depth)
  if (/%2f|%5c|%2F|%5C/i.test(name)) throw new Error('Invalid path')
  // Reject absolute paths
  if (isAbsolute(name)) throw new Error('Invalid path')
  // Decode URL encoding (up to 3 levels) and check for traversal in all forms
  let decoded = name
  try { for (let i = 0; i < 3; i++) { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; } } catch {}
  const candidates = [name, decoded]
  for (const s of candidates) {
    const lower = s.toLowerCase()
    if (s === '..' || lower === '%2e%2e' || lower === '..') {
      throw new Error('Invalid path')
    }
    if (s.startsWith('../') || s.startsWith('..\\') || s.includes('/../') || s.includes('\\..\\') || s.endsWith('/..') || s.endsWith('\\..')) {
      throw new Error('Invalid path')
    }
}
}

/**
 * Validate a filename and resolve it within an allowed directory.
 * Uses realpathSync to detect symlink escapes, falls back to resolve for non-existent files.
 * Returns the resolved absolute path.
 */
export function validateAndResolve(filename, allowedDir) {
  validateFilename(filename)
  const absPath = join(allowedDir, filename)
  return validateWithin(absPath, allowedDir)
}

/**
 * Resolve a file path and verify it stays within an allowed directory.
 * Uses realpathSync to detect symlink escapes, falls back to resolve for non-existent files.
 */
export function validateWithin(filePath, allowedDir) {
  if (typeof filePath !== 'string' || filePath.includes('\0') || filePath.trim() === '') {
    throw new Error('Invalid path')
  }
  const allowed = resolve(allowedDir)
  let resolved
  try { resolved = realpathSync(filePath) } catch {
    // File doesn't exist — resolve parent to detect symlink traversal
    const parent = dirname(filePath)
    let realParent
    try { realParent = realpathSync(parent) } catch { realParent = resolve(parent) }
    resolved = join(realParent, basename(filePath))
  }
  const rel = relative(allowed, resolved)
  // Allow resolved === allowed (the directory itself is within itself)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('Access denied: path outside allowed directory')
  }
  return resolved
}


/**
 * Validate and resolve an asset-relative path within userData/assets.
 * Used by readAsset and edex-audio protocol handler.
 * Returns the resolved absolute path.
 */
export function validateAssetPath(relativePath, userData) {
  if (typeof relativePath !== 'string' || relativePath.includes('\0')) throw new Error('Invalid path')
  if (!relativePath || relativePath.trim() === '') throw new Error('Invalid path: empty')
  const absPath = join(userData, 'assets', relativePath)
  const assetsDir = resolve(join(userData, 'assets'))
  let absResolved
  try { absResolved = realpathSync(absPath) } catch {
    const parent = dirname(absPath)
    let realParent
    try { realParent = realpathSync(parent) } catch { realParent = resolve(parent) }
    absResolved = join(realParent, basename(absPath))
  }
  const rel = relative(assetsDir, absResolved)
  // Note: rel === '' is intentionally rejected here (unlike validateWithin) because assets are always files, never the directory itself
  if (rel.startsWith('..') || isAbsolute(rel) || rel === '') {
    throw new Error('Path traversal detected')
  }
  return absResolved
}

