// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderShortcutsHelp } from '../../src/renderer/shortcuts-editor.js'

describe('renderShortcutsHelp', () => {
  const mockShortcuts = [
    { type: 'app', action: 'COPY', trigger: 'Ctrl+C', enabled: true },
    { type: 'shell', action: 'ls', trigger: 'Ctrl+L', enabled: true, linebreak: false },
  ]

  it('produces valid HTML table structure with matched tr tags', () => {
    const { html } = renderShortcutsHelp(mockShortcuts, '1.0.0')
    const openTr = (html.match(/<tr>/g) || []).length
    const closeTr = (html.match(/<\/tr>/g) || []).length
    expect(openTr).toBe(closeTr)
  })
})
