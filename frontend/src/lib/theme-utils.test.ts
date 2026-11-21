import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_THEME_COLOR, normalizeThemeColor, setThemeColor } from '@/lib/theme-utils'

const VARS = [
  '--primary',
  '--primary-foreground',
  '--ring',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--accent',
  '--accent-foreground',
  '--muted',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
]

function readVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name)
}

afterEach(() => {
  for (const name of VARS) {
    document.documentElement.style.removeProperty(name)
  }
})

describe('setThemeColor', () => {
  it('applies the accent color to primary, ring, and sidebar tokens', () => {
    setThemeColor('#ff0000')

    expect(readVar('--primary')).toBe('#ff0000')
    expect(readVar('--ring')).toBe('#ff0000')
    expect(readVar('--sidebar-primary')).toBe('#ff0000')
    expect(readVar('--primary-foreground')).toBe('#0C0D12')
    expect(readVar('--sidebar-primary-foreground')).toBe('#0C0D12')
  })

  it('mixes accent surfaces toward black and accent text toward white', () => {
    setThemeColor('#ff0000')
    expect(readVar('--accent')).toContain('black')
    expect(readVar('--accent-foreground')).toContain('white')
  })

  it('derives every accent variable from the chosen colour', () => {
    setThemeColor('#ff0000')

    for (const name of VARS) {
      expect(readVar(name), name).not.toBe('')
    }
  })

  it('clears the overrides when the deployment sets no colour', () => {
    // Leaving stale properties behind would pin a previous admin's brand
    // colour after they cleared it.
    setThemeColor('#ff0000')
    setThemeColor(null)

    for (const name of VARS) {
      expect(readVar(name), name).toBe('')
    }
  })

  it('migrates the former stock indigo to the new pink accent', () => {
    expect(normalizeThemeColor('#818CF8')).toBe(DEFAULT_THEME_COLOR)
    setThemeColor('#818CF8')
    expect(readVar('--primary')).toBe(DEFAULT_THEME_COLOR)
    expect(readVar('--primary-foreground')).toBe('#0C0D12')
  })
})
