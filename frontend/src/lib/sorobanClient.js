import {
  Contract,
  rpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
} from '@stellar/stellar-sdk'
import { NETWORK_PASSPHRASE, RPC_URL } from './config'
import { signTransaction } from './wallet'

const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') })

export function getServer() {
  return server
}

export async function invokeContract({ contractId, method, args = [], sourcePublicKey }) {
  const account = await server.getAccount(sourcePublicKey)
  const contract = new Contract(contractId)

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build()

  const simulated = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed: ${simulated.error}`)
  }

  const prepared = rpc.assembleTransaction(tx, simulated).build()
  const signedXdr = await signTransaction(prepared.toXDR(), NETWORK_PASSPHRASE)
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)

  const sendResponse = await server.sendTransaction(signedTx)
  if (sendResponse.status === 'ERROR') {
    throw new Error(`Transaction submission failed: ${JSON.stringify(sendResponse.errorResult)}`)
  }

  const hash = sendResponse.hash
  const finalStatus = await pollTransaction(hash)

  let result = null
  if (finalStatus.status === 'SUCCESS' && finalStatus.returnValue) {
    result = scValToNative(finalStatus.returnValue)
  }

  return { result, hash, status: finalStatus.status }
}

export async function readContract({ contractId, method, args = [], sourcePublicKey }) {
  const account = sourcePublicKey
    ? await server.getAccount(sourcePublicKey)
    : new (await import('@stellar/stellar-sdk')).Account(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '0'
      )
  const contract = new Contract(contractId)

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()

  const simulated = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed: ${simulated.error}`)
  }
  if (!simulated.result) return null
  return scValToNative(simulated.result.retval)
}

async function pollTransaction(hash, attempts = 15, delayMs = 1500) {
  for (let i = 0; i < attempts; i++) {
    const response = await server.getTransaction(hash)
    if (response.status !== 'NOT_FOUND') {
      return response
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  throw new Error('Transaction confirmation timed out. Check the explorer for final status.')
}

export function addressToScVal(address) {
  return nativeToScVal(Address.fromString(address), { type: 'address' })
}

export function stringToScVal(value) {
  return nativeToScVal(value, { type: 'string' })
}

export function i128ToScVal(value) {
  return nativeToScVal(BigInt(value), { type: 'i128' })
}

export function u64ToScVal(value) {
  return nativeToScVal(BigInt(value), { type: 'u64' })
}
