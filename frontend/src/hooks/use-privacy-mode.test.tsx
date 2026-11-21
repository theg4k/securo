import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'

import { usePrivacyMode } from '@/hooks/use-privacy-mode'

describe('usePrivacyMode', () => {
  it('always displays values and has no toggle state', () => {
    const { result } = renderHook(() => usePrivacyMode())

    expect(result.current.privacyMode).toBe(false)
    expect(result.current.mask('R$ 12.480,00')).toBe('R$ 12.480,00')
    expect('togglePrivacyMode' in result.current).toBe(false)
  })
})
