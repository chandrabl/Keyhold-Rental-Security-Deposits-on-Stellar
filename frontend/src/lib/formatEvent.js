// Pure function mapping decoded contract event topics to human-readable
// feed entries. No SDK calls, no side effects — kept trivial to unit test.

const TOPIC_LABELS = {
  'lease,created': { label: 'Lease Drafted', tone: 'neutral' },
  'lease,funded': { label: 'Deposit Funded', tone: 'go' },
  'lease,cancel': { label: 'Lease Cancelled', tone: 'stop' },
  'lease,claimed': { label: 'Damage Claim Filed', tone: 'stop' },
  'lease,released': { label: 'Deposit Released to Tenant', tone: 'go' },
  'lease,settled': { label: 'Claim Settled', tone: 'hold' },
  'claim,filed': { label: 'Claim Registered with Inspector', tone: 'stop' },
  'claim,resolved': { label: 'Inspector Ruling Issued', tone: 'hold' },
  'inspect,added': { label: 'Inspector Added to Panel', tone: 'neutral' },
}

export function formatEvent(event) {
  if (!event || !Array.isArray(event.topics)) {
    return { label: 'Unknown Event', tone: 'neutral', detail: '' }
  }

  const symbolTopics = event.topics.filter((t) => typeof t === 'string')
  const key = symbolTopics.slice(0, 2).join(',')
  const meta = TOPIC_LABELS[key] || { label: symbolTopics.join(' / ') || 'Event', tone: 'neutral' }

  return {
    id: event.id,
    label: meta.label,
    tone: meta.tone,
    ledger: event.ledger,
    txHash: event.txHash,
    timestamp: event.timestamp,
    raw: event,
  }
}

export function formatEvents(events) {
  return events.map(formatEvent)
}
