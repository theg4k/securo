import { describe, expect, it } from 'vitest'
import { nextTheme } from './theme-cycle'

describe('nextTheme', () => {
  it('always resolves to the only supported theme', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('system')).toBe('dark')
    expect(nextTheme(undefined)).toBe('dark')
  })
})
