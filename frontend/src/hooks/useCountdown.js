import { useState, useEffect } from 'react'

/** Ticks every second, returning a formatted "time until" a target unix timestamp. */
export function useCountdown(targetUnixSeconds) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!targetUnixSeconds) return { label: '—', passed: false, secondsLeft: 0 }

  const secondsLeft = targetUnixSeconds - now
  if (secondsLeft <= 0) {
    return { label: 'Passed', passed: true, secondsLeft: 0 }
  }

  const days = Math.floor(secondsLeft / 86400)
  const hours = Math.floor((secondsLeft % 86400) / 3600)
  const minutes = Math.floor((secondsLeft % 3600) / 60)
  const seconds = secondsLeft % 60

  let label
  if (days > 0) label = `${days}d ${hours}h`
  else if (hours > 0) label = `${hours}h ${minutes}m`
  else if (minutes > 0) label = `${minutes}m ${seconds}s`
  else label = `${seconds}s`

  return { label, passed: false, secondsLeft }
}
