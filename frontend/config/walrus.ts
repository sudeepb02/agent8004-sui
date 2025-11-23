'use client'

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'

// Walrus client configuration
export const createWalrusClient = async () => {
  // Dynamic import to ensure client-side only
  const { walrus } = await import('@mysten/walrus')

  const client = new SuiClient({
    url: getFullnodeUrl('testnet'),
  }).$extend(
    walrus({
      network: 'testnet',
      uploadRelay: {
        host: 'https://upload-relay.testnet.walrus.space',
        sendTip: {
          max: 100_000, // Maximum tip in MIST
        },
      },
      storageNodeClientOptions: {
        timeout: 60_000,
        onError: (error) => {
          console.error('Walrus storage node error:', error)
        },
      },
    })
  )

  return client
}

// Walrus configuration constants
export const WALRUS_CONFIG = {
  DEFAULT_EPOCHS: 10, // Store for 10 epochs by default
  DELETABLE: false,
} as const
