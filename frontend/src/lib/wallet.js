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

export { NETWORK_PASSPHRASES }
