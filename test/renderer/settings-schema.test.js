import { describe, it, expect } from 'vitest'
import { SETTINGS_SCHEMA, getSchemaKeys, getDefaults } from '../../src/shared/settings-schema.js'

describe('SETTINGS_SCHEMA', () => {
  it('select entries with numeric defaultValue have numeric options', () => {
    const clockEntry = SETTINGS_SCHEMA.find(e => e.key === 'clockHours')
    expect(clockEntry).toBeDefined()
    expect(clockEntry.type).toBe('select')
    expect(typeof clockEntry.defaultValue).toBe('number')
    clockEntry.options.forEach(opt => {
      expect(typeof opt).toBe('number')
    })
  })

  it('getSchemaKeys returns all schema keys', () => {
    const keys = getSchemaKeys()
    expect(keys).toContain('clockHours')
    expect(keys).toContain('monitor')
    expect(keys).toContain('keyboard')
    expect(keys.length).toBe(SETTINGS_SCHEMA.length)
  })
})

describe('getDefaults', () => {
  it('returns default values for all schema entries with defaults', () => {
    const defaults = getDefaults()
    expect(defaults.theme).toBe('tron')
    expect(defaults.shell).toBe('/bin/bash')
    expect(typeof defaults.termFontSize).toBe('number')
    expect(typeof defaults.audio).toBe('boolean')
  })

  it('returns an object with all schema keys that have defaultValue', () => {
    const defaults = getDefaults()
    const keysWithDefaults = SETTINGS_SCHEMA.filter(e => e.defaultValue !== undefined).map(e => e.key)
    expect(Object.keys(defaults).sort()).toEqual(keysWithDefaults.sort())
  })
})
