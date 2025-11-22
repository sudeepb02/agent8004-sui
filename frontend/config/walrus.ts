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
