import {
  isConnected,
  requestAccess,
  getAddress,
  getNetworkDetails as freighterGetNetworkDetails,
  signTransaction as freighterSignTransaction,
} from '@stellar/freighter-api'

const NETWORK_PASSPHRASES = {
  TESTNET: 'Test SDF Network ; September 2015',
  PUBLIC: 'Public Global Stellar Network ; September 2015',
}

export async function isFreighterInstalled() {
  return await isConnected()
}

export async function connectWallet() {
  if (!(await isConnected())) {
    throw new Error(
      'Freighter wallet extension not found. Install it from freighter.app to continue.'
    )
  }
  const access = await requestAccess()
  if (access.error) {
    throw new Error(access.error)
  }
  const addressResult = await getAddress()
  if (addressResult.error) {
    throw new Error(addressResult.error)
  }
  return addressResult.address
}

export async function getNetworkDetails() {
  if (!(await isConnected())) return null
  return freighterGetNetworkDetails()
}

export async function signTransaction(xdr, networkPassphrase) {
  if (!(await isConnected())) {
    throw new Error('Freighter wallet extension not found.')
  }
  const result = await freighterSignTransaction(xdr, {
    networkPassphrase,
  })
  if (result.error) {
    throw new Error(result.error)
  }
  return result.signedTxXdr || result
}

export async function getXlmBalance(address, isPublic = false) {
  try {
    const url = isPublic 
      ? `https://horizon.stellar.org/accounts/${address}`
      : `https://horizon-testnet.stellar.org/accounts/${address}`
    const res = await fetch(url)
    if (!res.ok) return '0.00'
    const data = await res.json()
    const balance = data.balances.find((b) => b.asset_type === 'native')
    return balance ? parseFloat(balance.balance).toFixed(2) : '0.00'
  } catch (err) {
    console.error('Failed to fetch XLM balance:', err)
    return '0.00'
  }
}

export { NETWORK_PASSPHRASES }
