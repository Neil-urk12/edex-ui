// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { collectSettingsFromDOM, renderSettingsEditor } from '../../src/renderer/settings-editor.js'

// Mock escapeHtml used by renderSettingsEditor
vi.mock('../../src/renderer/utils.js', () => ({
  escapeHtml: (text) => String(text),
}))

describe('collectSettingsFromDOM', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns number for select with numeric defaultValue', () => {
    const schema = [
      { key: 'clockHours', type: 'select', description: 'Clock format', defaultValue: 24, options: [12, 24] },
    ]
    vi.spyOn(document, 'getElementById').mockReturnValue({ value: '12' })

    const result = collectSettingsFromDOM(schema)
    expect(result.clockHours).toBe(12)
    expect(typeof result.clockHours).toBe('number')
  })

  it('returns number for select with source and numeric defaultValue', () => {
    const schema = [
      { key: 'monitor', type: 'select', description: 'Monitor', defaultValue: 0, source: 'displays' },
    ]
    vi.spyOn(document, 'getElementById').mockReturnValue({ value: '1' })

    const result = collectSettingsFromDOM(schema)
    expect(result.monitor).toBe(1)
    expect(typeof result.monitor).toBe('number')
  })

  it('returns string for select with string defaultValue', () => {
    const schema = [
      { key: 'keyboard', type: 'select', description: 'Keyboard', defaultValue: 'en_US', source: 'keyboards' },
    ]
    vi.spyOn(document, 'getElementById').mockReturnValue({ value: 'fr_FR' })

    const result = collectSettingsFromDOM(schema)
    expect(result.keyboard).toBe('fr_FR')
    expect(typeof result.keyboard).toBe('string')
  })
})
