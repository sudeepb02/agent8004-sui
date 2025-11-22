'use client'

import { createWalrusClient, WALRUS_CONFIG } from '@/config/walrus'

export interface Endpoint {
  name: string
  endpoint: string
  version?: string
  capabilities?: Record<string, any>
}

export interface Registration {
  agentId: number
  agentRegistry: string
}

export interface AgentMetadata {
  type: string
  name: string
  description: string
  image: string
  endpoints: Endpoint[]
  registrations?: Registration[]
  supportedTrust?: string[]
  [key: string]: any // Allow additional properties
}

export async function storeMetadataOnWalrus(
  metadata: AgentMetadata,
  signer: any,
  epochs: number = WALRUS_CONFIG.DEFAULT_EPOCHS
): Promise<{ blobId: string; walrusUri: string }> {
  try {
    // Dynamic import for client-side only
    const { WalrusFile } = await import('@mysten/walrus')
    const client = await createWalrusClient()

    // Convert metadata to JSON string and then to bytes
    const metadataJson = JSON.stringify(metadata, null, 2)
    const metadataBytes = new TextEncoder().encode(metadataJson)

    // Create a WalrusFile from the metadata
    const file = WalrusFile.from({
      contents: metadataBytes,
      identifier: 'metadata.json',
      tags: {
        'content-type': 'application/json',
        'agent-metadata': 'true',
      },
    })

    console.log('Storing metadata on Walrus...', {
      size: metadataBytes.length,
      epochs,
    })

    // Write the file to Walrus
    const results = await client.walrus.writeFiles({
      files: [file],
      epochs: epochs,
      deletable: WALRUS_CONFIG.DELETABLE,
      signer: signer,
    })

    if (results.length === 0) {
      throw new Error('Failed to store metadata on Walrus')
    }

    const { blobId } = results[0]
    const walrusUri = `walrus://${blobId}`

    console.log('Metadata stored on Walrus:', {
      blobId,
      walrusUri,
    })

    return { blobId, walrusUri }
  } catch (error) {
    console.error('Error storing metadata on Walrus:', error)
    throw new Error(
      `Failed to store metadata on Walrus: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function storeMetadataWithFlow(
  metadata: AgentMetadata,
  owner: string,
  signAndExecuteTransaction: any,
  suiClient: any,
  epochs: number = WALRUS_CONFIG.DEFAULT_EPOCHS
): Promise<{ blobId: string; walrusUri: string }> {
  try {
    // Dynamic import for client-side only
    const { WalrusFile, walrus } = await import('@mysten/walrus')
    const { SuiJsonRpcClient } = await import('@mysten/sui/jsonRpc')
    const { getFullnodeUrl } = await import('@mysten/sui/client')
    
    // Create a Walrus client - must use SuiJsonRpcClient with network param
    const client = new SuiJsonRpcClient({
      url: getFullnodeUrl('testnet'),
      network: 'testnet',
    }).$extend(
      walrus({
        storageNodeClientOptions: {
          timeout: 60_000,
          onError: (error: any) => {
            console.error('Walrus storage node error:', error)
          },
        },
      })
    )

    // Convert metadata to JSON string and then to bytes
    const metadataJson = JSON.stringify(metadata, null, 2)
    const metadataBytes = new TextEncoder().encode(metadataJson)

    // Create a WalrusFile from the metadata
    const file = WalrusFile.from({
      contents: metadataBytes,
      identifier: 'metadata.json',
      tags: {
        'content-type': 'application/json',
        'agent-metadata': 'true',
      },
    })

    console.log('Creating Walrus write flow for browser...', {
      size: metadataBytes.length,
      epochs,
    })

    // Step 1: Create and encode the flow
    const flow = client.walrus.writeFilesFlow({
      files: [file],
    })
    
    await flow.encode()
    console.log('Flow encoded')

    // Step 2: Register the blob
    const registerTx = flow.register({
      epochs: epochs,
      owner: owner,
      deletable: WALRUS_CONFIG.DELETABLE,
    })

    // Execute register transaction and wait for result
    const registerResult = await new Promise<{ digest: string }>((resolve, reject) => {
      signAndExecuteTransaction(
        { transaction: registerTx },
        {
          onSuccess: (result: any) => {
            console.log('Blob registered:', result.digest)
            resolve({ digest: result.digest })
          },
          onError: (error: any) => {
            console.error('Failed to register blob:', error)
            reject(error)
          },
        }
      )
    })

    // Step 3: Upload the data to storage nodes
    await flow.upload({ digest: registerResult.digest })
    console.log('Data uploaded to storage nodes')

    // Step 4: Certify the blob
    const certifyTx = flow.certify()
    
    await new Promise<void>((resolve, reject) => {
      signAndExecuteTransaction(
        { transaction: certifyTx },
        {
          onSuccess: (result: any) => {
            console.log('Blob certified:', result.digest)
            resolve()
          },
          onError: (error: any) => {
            console.error('Failed to certify blob:', error)
            reject(error)
          },
        }
      )
    })

    // Step 5: Get the created files
    const files = await flow.listFiles()

    if (files.length === 0) {
      throw new Error('No files created')
    }

    const blobId = files[0].id
    const walrusUri = `walrus://${blobId}`

    console.log('Metadata stored on Walrus:', {
      blobId,
      walrusUri,
    })

    return { blobId, walrusUri }
  } catch (error) {
    console.error('Error storing metadata on Walrus with flow:', error)
    throw new Error(
      `Failed to store metadata on Walrus: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function readMetadataFromWalrus(
  blobId: string
): Promise<AgentMetadata> {
  try {
    const client = await createWalrusClient()

    // Remove walrus:// prefix if present
    const cleanBlobId = blobId.replace('walrus://', '')

    console.log('Reading metadata from Walrus:', cleanBlobId)

    // Read the file from Walrus
    const [file] = await client.walrus.getFiles({
      ids: [cleanBlobId],
    })

    // Parse the file as JSON
    const metadata = (await file.json()) as AgentMetadata

    console.log('Metadata read from Walrus:', metadata)

    return metadata
  } catch (error) {
    console.error('Error reading metadata from Walrus:', error)
    throw new Error(
      `Failed to read metadata from Walrus: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export function formatWalrusUri(blobId: string): string {
  return `walrus://${blobId}`
}

export function extractBlobId(uri: string): string {
  return uri.replace('walrus://', '')
}
