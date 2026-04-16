import {
  BrowserProvider,
  JsonRpcProvider,
  getAddress,
  isAddress,
  verifyMessage,
} from 'ethers'

const ENS_RPC_URL = 'https://ethereum-rpc.publicnode.com'
const ensProvider = new JsonRpcProvider(ENS_RPC_URL)

export function buildIdentityBindingMessage({ peerId, publicKey }) {
  return [
    'FindYourPeer identity binding',
    `Peer ID: ${peerId}`,
    `App public key: ${publicKey}`,
  ].join('\n')
}

export function normalizeEnsName(value) {
  const trimmed = value?.trim().toLowerCase()
  return trimmed ? trimmed : null
}

export async function connectBlockchainIdentity({ peerId, publicKey, ensName }) {
  if (!window.ethereum) {
    throw new Error('No Ethereum wallet detected in this browser.')
  }

  const walletProvider = new BrowserProvider(window.ethereum, 'any')
  await walletProvider.send('eth_requestAccounts', [])

  const signer = await walletProvider.getSigner()
  const walletAddress = getAddress(await signer.getAddress())
  const network = await walletProvider.getNetwork()
  const normalizedEns = normalizeEnsName(ensName)

  if (normalizedEns) {
    await assertEnsOwnership(normalizedEns, walletAddress)
  }

  const walletSignature = await signer.signMessage(
    buildIdentityBindingMessage({ peerId, publicKey })
  )

  const primaryEns = normalizedEns ?? await lookupPrimaryEns(walletAddress)

  return {
    walletAddress,
    ensName: primaryEns,
    chainId: Number(network.chainId),
    walletSignature,
  }
}

export async function verifyBlockchainIdentity(profile) {
  if (!profile?.blockchainIdentity) {
    return {
      verified: false,
      ensName: null,
      walletAddress: null,
      reason: 'No blockchain identity attached.',
    }
  }

  const { walletAddress, ensName, walletSignature } = profile.blockchainIdentity
  if (!walletAddress || !walletSignature || !isAddress(walletAddress)) {
    return {
      verified: false,
      ensName: null,
      walletAddress: null,
      reason: 'Malformed wallet identity.',
    }
  }

  try {
    const checksummed = getAddress(walletAddress)
    const recovered = getAddress(
      verifyMessage(
        buildIdentityBindingMessage({
          peerId: profile.peerId,
          publicKey: profile.publicKey,
        }),
        walletSignature
      )
    )

    if (recovered !== checksummed) {
      return {
        verified: false,
        ensName: null,
        walletAddress: checksummed,
        reason: 'Wallet signature does not match the claimed address.',
      }
    }

    const normalizedEns = normalizeEnsName(ensName)
    if (normalizedEns) {
      try {
        await assertEnsOwnership(normalizedEns, checksummed)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'ENS verification failed.'
        if (message.includes('does not resolve')) {
          return {
            verified: false,
            ensName: null,
            walletAddress: checksummed,
            reason: message,
          }
        }

        return {
          verified: true,
          ensName: null,
          walletAddress: checksummed,
          reason: `Wallet signature verified, but ENS lookup was unavailable: ${message}`,
        }
      }
    }

    return {
      verified: true,
      ensName: normalizedEns,
      walletAddress: checksummed,
      reason: normalizedEns ? 'ENS name resolves to the bound wallet.' : 'Wallet signature verified.',
    }
  } catch (error) {
    return {
      verified: false,
      ensName: null,
      walletAddress: null,
      reason: error instanceof Error ? error.message : 'Blockchain verification failed.',
    }
  }
}

export async function lookupPrimaryEns(walletAddress) {
  try {
    return await ensProvider.lookupAddress(walletAddress)
  } catch {
    return null
  }
}

export function formatWalletAddress(walletAddress) {
  if (!walletAddress || !isAddress(walletAddress)) return null
  const checksummed = getAddress(walletAddress)
  return `${checksummed.slice(0, 6)}...${checksummed.slice(-4)}`
}

async function assertEnsOwnership(ensName, walletAddress) {
  const resolved = await ensProvider.resolveName(ensName)
  if (!resolved) {
    throw new Error(`ENS name ${ensName} does not resolve on mainnet.`)
  }

  if (getAddress(resolved) !== getAddress(walletAddress)) {
    throw new Error(`ENS name ${ensName} does not resolve to the connected wallet.`)
  }
}
