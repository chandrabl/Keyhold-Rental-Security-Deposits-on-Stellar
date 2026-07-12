import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchNewEvents } from '../lib/events'
import { formatEvents } from '../lib/formatEvent'
import { isConfigured } from '../lib/config'

const POLL_INTERVAL_MS = 6000

export function useEventStream() {
  const [feed, setFeed] = useState([])
  const [isPolling, setIsPolling] = useState(false)
  const [pollError, setPollError] = useState(null)
  const mounted = useRef(true)

  const poll = useCallback(async () => {
    if (!isConfigured()) return
    try {
      setIsPolling(true)
      const events = await fetchNewEvents()
      if (!mounted.current) return
      if (events.length > 0) {
        const formatted = formatEvents(events).reverse()
        setFeed((prev) => [...formatted, ...prev].slice(0, 50))
      }
      setPollError(null)
    } catch (err) {
      if (mounted.current) setPollError(err.message)
    } finally {
      if (mounted.current) setIsPolling(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      mounted.current = false
      clearInterval(interval)
    }
  }, [poll])

  return { feed, isPolling, pollError, refresh: poll }
}
