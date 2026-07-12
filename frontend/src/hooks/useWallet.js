import { useState, useCallback, useEffect } from 'react'
import { connectWallet, isFreighterInstalled } from '../lib/wallet'

export function useWallet() {
  const [address, setAddress] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [installed, setInstalled] = useState(true)

  useEffect(() => {
    setInstalled(isFreighterInstalled())
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      const addr = await connectWallet()
      setAddress(addr)
    } catch (err) {
      setError(err.message || 'Failed to connect wallet')
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAddress(null)
  }, [])

  return { address, connecting, error, installed, connect, disconnect }
}
