// Security constants for shell validation, file opening, and app paths.
// Co-located here for testability and discoverability.

export const SAFE_OPEN_EXTENSIONS = [
  // Original
  '.txt', '.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.md', '.html', '.css', '.js', '.wav', '.mp3', '.ogg',
  // Data
  '.log', '.csv', '.tsv', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  // Media
  '.svg', '.mp4', '.webm', '.mkv', '.avi', '.mov', '.flac', '.m4a', '.aac', '.opus', '.bmp', '.tiff', '.ico', '.avif',
  // Documents
  '.rtf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
  // Archives
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  // Web
  '.jsx', '.tsx', '.ts', '.vue', '.svelte', '.astro', '.scss', '.less', '.sass',
]

export const ALLOWED_APP_PATHS = ['home', 'appData', 'userData', 'desktop', 'documents', 'downloads', 'temp', 'logs', 'crashDumps']

export const TRUSTED_SHELL_DIRS = [
  '/bin/', '/usr/bin/', '/usr/local/bin/',
  '/opt/homebrew/bin/',
  '/run/current-system/sw/bin/',
  '/snap/bin/',
]

export const TRUSTED_WINDOWS_SHELLS = ['powershell.exe', 'cmd.exe', 'pwsh.exe']

export const ALLOWED_SHELL_NAMES = ['bash', 'sh', 'zsh', 'fish', 'powershell.exe', 'cmd.exe', 'pwsh.exe']

export function isShellAllowed(resolvedPath) {
  const base = resolvedPath.split(/[/\\]/).pop().toLowerCase()
  if (TRUSTED_WINDOWS_SHELLS.includes(base)) return true
  if (!TRUSTED_SHELL_DIRS.some(dir => resolvedPath.startsWith(dir))) return false
  return ALLOWED_SHELL_NAMES.includes(base)
}
