import { describe, it, expect } from 'vitest'
import { formatEvent, formatEvents } from '../lib/formatEvent'

describe('formatEvent', () => {
  it('labels a lease created event correctly', () => {
    const event = { id: '1', topics: ['lease', 'created', 0], ledger: 100 }
    const result = formatEvent(event)
    expect(result.label).toBe('Lease Drafted')
    expect(result.tone).toBe('neutral')
  })

  it('labels a lease funded event with go tone', () => {
    const event = { id: '2', topics: ['lease', 'funded', 0], ledger: 101 }
    const result = formatEvent(event)
    expect(result.label).toBe('Deposit Funded')
    expect(result.tone).toBe('go')
  })

  it('labels a claim filed event with stop tone', () => {
    const event = { id: '3', topics: ['lease', 'claimed', 0], ledger: 102 }
    const result = formatEvent(event)
    expect(result.label).toBe('Damage Claim Filed')
    expect(result.tone).toBe('stop')
  })

  it('labels a deposit released event with go tone', () => {
    const event = { id: '4', topics: ['lease', 'released', 0], ledger: 103 }
    const result = formatEvent(event)
    expect(result.label).toBe('Deposit Released to Tenant')
    expect(result.tone).toBe('go')
  })

  it('labels an inspector ruling with hold tone', () => {
    const event = { id: '5', topics: ['claim', 'resolved', 0], ledger: 104 }
    const result = formatEvent(event)
    expect(result.label).toBe('Inspector Ruling Issued')
    expect(result.tone).toBe('hold')
  })

  it('falls back gracefully for unrecognized topics', () => {
    const event = { id: '6', topics: ['mystery', 'thing'], ledger: 105 }
    const result = formatEvent(event)
    expect(result.label).toBe('mystery / thing')
    expect(result.tone).toBe('neutral')
  })

  it('handles malformed or missing event input without throwing', () => {
    expect(formatEvent(null).label).toBe('Unknown Event')
    expect(formatEvent({}).label).toBe('Unknown Event')
    expect(formatEvent({ topics: null }).label).toBe('Unknown Event')
  })

  it('preserves ledger, txHash, and timestamp metadata', () => {
    const event = { id: '7', topics: ['lease', 'settled', 2], ledger: 200, txHash: 'deadbeef', timestamp: '2026-07-08T12:00:00Z' }
    const result = formatEvent(event)
    expect(result.ledger).toBe(200)
    expect(result.txHash).toBe('deadbeef')
    expect(result.timestamp).toBe('2026-07-08T12:00:00Z')
  })
})

describe('formatEvents', () => {
  it('maps an array of raw events to formatted entries in order', () => {
    const events = [
      { id: '1', topics: ['lease', 'created'], ledger: 1 },
      { id: '2', topics: ['lease', 'claimed'], ledger: 2 },
    ]
    const results = formatEvents(events)
    expect(results).toHaveLength(2)
    expect(results[0].label).toBe('Lease Drafted')
    expect(results[1].label).toBe('Damage Claim Filed')
  })

  it('returns an empty array when given no events', () => {
    expect(formatEvents([])).toEqual([])
  })
})
