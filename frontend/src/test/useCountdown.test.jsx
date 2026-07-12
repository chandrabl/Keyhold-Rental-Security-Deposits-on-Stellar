import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCountdown } from '../hooks/useCountdown'

describe('useCountdown', () => {
  it('returns a placeholder when no target is given', () => {
    const { result } = renderHook(() => useCountdown(null))
    expect(result.current.label).toBe('—')
    expect(result.current.passed).toBe(false)
  })

  it('reports passed when target is in the past', () => {
    const past = Math.floor(Date.now() / 1000) - 100
    const { result } = renderHook(() => useCountdown(past))
    expect(result.current.passed).toBe(true)
    expect(result.current.label).toBe('Passed')
  })

  it('formats a future target in days and hours', () => {
    const future = Math.floor(Date.now() / 1000) + 2 * 86400 + 3600
    const { result } = renderHook(() => useCountdown(future))
    expect(result.current.passed).toBe(false)
    expect(result.current.label).toMatch(/\dd \dh/)
  })
})
