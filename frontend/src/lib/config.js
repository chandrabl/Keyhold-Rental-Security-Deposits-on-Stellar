export const NETWORK = import.meta.env.VITE_STELLAR_NETWORK || 'TESTNET'

export const RPC_URL =
  import.meta.env.VITE_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'

export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_NETWORK_PASSPHRASE ||
  'Test SDF Network ; September 2015'

export const DEPOSIT_CONTRACT_ID = import.meta.env.VITE_DEPOSIT_CONTRACT_ID || ''

export const INSPECTION_CONTRACT_ID = import.meta.env.VITE_INSPECTION_CONTRACT_ID || ''

export const TOKEN_CONTRACT_ID = import.meta.env.VITE_TOKEN_CONTRACT_ID || ''

export const EXPLORER_TX_URL = (hash) =>
  NETWORK === 'PUBLIC'
    ? `https://stellar.expert/explorer/public/tx/${hash}`
    : `https://stellar.expert/explorer/testnet/tx/${hash}`

export const EXPLORER_CONTRACT_URL = (id) =>
  NETWORK === 'PUBLIC'
    ? `https://stellar.expert/explorer/public/contract/${id}`
    : `https://stellar.expert/explorer/testnet/contract/${id}`

export const isConfigured = () =>
  Boolean(DEPOSIT_CONTRACT_ID && INSPECTION_CONTRACT_ID && TOKEN_CONTRACT_ID)
