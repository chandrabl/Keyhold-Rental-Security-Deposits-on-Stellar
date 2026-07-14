import { useState, useCallback, useEffect } from 'react'
import { connectWallet, isFreighterInstalled, getXlmBalance } from '../lib/wallet'
import { NETWORK } from '../lib/config'

export function useWallet() {
  const [address, setAddress] = useState(null)
  const [balance, setBalance] = useState('0.00')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [installed, setInstalled] = useState(true)

  useEffect(() => {
    isFreighterInstalled().then(setInstalled)
  }, [])

  const refreshBalance = useCallback(async (addr = address) => {
    if (!addr) return
    const bal = await getXlmBalance(addr, NETWORK === 'PUBLIC')
    setBalance(bal)
  }, [address])

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      const addr = await connectWallet()
      setAddress(addr)
      await refreshBalance(addr)
    } catch (err) {
      setError(err.message || 'Failed to connect wallet')
    } finally {
      setConnecting(false)
    }
  }, [refreshBalance])

  const disconnect = useCallback(() => {
    setAddress(null)
    setBalance('0.00')
  }, [])

  return { address, balance, connecting, error, installed, connect, disconnect, refreshBalance }
}
