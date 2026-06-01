// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { collectSettingsFromDOM, renderSettingsEditor } from '../../src/renderer/settings-editor.js'

vi.mock('../../src/renderer/utils.js', () => ({
  escapeHtml: (text) => String(text),
}))

describe('unknown schema type handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renderSettingsEditor does not crash on unknown type', () => {
    const schema = [
      { key: 'bad', type: 'unknown_type', description: 'test setting' },
    ]
    const result = renderSettingsEditor(schema, {})
    expect(result).not.toContain('settingsEditor-bad')
    expect(result).not.toContain('unknown_type')
  })

  it('collectSettingsFromDOM does not crash on unknown type', () => {
    const schema = [
      { key: 'bad', type: 'unknown_type', description: 'test setting' },
    ]
    vi.spyOn(document, 'getElementById').mockReturnValue({ value: 'whatever' })

    const result = collectSettingsFromDOM(schema)
    expect(result.bad).toBeUndefined()
  })
})
