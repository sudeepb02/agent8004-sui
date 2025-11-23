import { SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { bcs } from '@mysten/sui/bcs'
import { CONTRACT_CONFIG, STRUCT_TYPES } from '@/config/contracts'
import type { Agent, Endpoint, Reputation } from '@/types'
import { readMetadataFromWalrus, extractBlobId, getWalrusHttpUrl, isWalrusUri } from './walrus'

/**
 * Parse endpoints from Move contract fields
 * Handles both direct field access and potential wrapping in fields object
 */
export function parseEndpoints(endpointsData: any[]): Endpoint[] {
  if (!endpointsData || !Array.isArray(endpointsData)) {
    return []
  }

  return endpointsData.map((ep: any) => {
    const name = ep.fields?.name || ep.name || ''
    const endpoint = ep.fields?.endpoint || ep.endpoint || ''
    const version = ep.fields?.version || ep.version || ''

    return { name, endpoint, version }
  })
}

/**
 * Parse agent fields from Move contract object
 */
export function parseAgentFields(fields: any, owner: string): Omit<Agent, 'metadata'> {
  const endpoints = parseEndpoints(fields.endpoints)

  return {
    id: fields.id?.id || '', // Will be overridden by objectId
    agentId: fields.agent_id,
    name: fields.name || '',
    description: fields.description || '',
    image: fields.image || '',
    tokenUri: fields.token_uri || '',
    endpoints,
    owner,
  }
}

/**
 * Load metadata from Walrus if tokenUri is available
 */
export async function loadAgentMetadata(agent: Agent): Promise<Agent> {
  // Always convert the agent's image URI from smart contract to HTTP URL if it's a Walrus URI
  const displayImage = agent.image && isWalrusUri(agent.image) 
    ? getWalrusHttpUrl(agent.image) 
    : agent.image
  
  if (agent.tokenUri && agent.tokenUri.startsWith('walrus://')) {
    try {
      const metadata = await readMetadataFromWalrus(extractBlobId(agent.tokenUri))
      // Return agent with metadata but keep the image from smart contract
      return { ...agent, metadata, image: displayImage }
    } catch (error) {
      console.log(`Could not load metadata for agent ${agent.agentId}:`, error)
    }
  }
  
  // Return agent with converted image URL
  return { ...agent, image: displayImage }
}

/**
 * Load a single agent from the blockchain by object ID
 */
export async function loadAgentById(
  suiClient: SuiClient,
  agentId: string,
  owner: string
): Promise<Agent | null> {
  try {
    const agentObject = await suiClient.getObject({
      id: agentId,
      options: {
        showContent: true,
        showType: true,
      },
    })

    if (agentObject.data?.content?.dataType === 'moveObject') {
      const fields = (agentObject.data.content as any).fields

      let agent: Agent = {
        ...parseAgentFields(fields, owner),
        id: agentObject.data.objectId,
      }

      // Load metadata from Walrus
      agent = await loadAgentMetadata(agent)

      return agent
    }
  } catch (error) {
    console.error(`Error loading agent ${agentId}:`, error)
  }

  return null
}

/**
 * Load all agents owned by a specific address
 */
export async function loadAgentsByOwner(
  suiClient: SuiClient,
  ownerAddress: string
): Promise<Agent[]> {
  try {
    const objects = await suiClient.getOwnedObjects({
      owner: ownerAddress,
      filter: {
        StructType: STRUCT_TYPES.AGENT,
      },
      options: {
        showContent: true,
        showType: true,
      },
    })

    const agents = await Promise.all(
      objects.data
        .filter((obj) => obj.data?.content?.dataType === 'moveObject')
        .map(async (obj: any) => {
          const fields = obj.data.content.fields

          let agent: Agent = {
            ...parseAgentFields(fields, ownerAddress),
            id: obj.data.objectId,
          }

          // Load metadata from Walrus
          agent = await loadAgentMetadata(agent)

          return agent
        })
    )

    return agents
  } catch (error) {
    console.error('Error loading agents by owner:', error)
    return []
  }
}

/**
 * Load all agents in the system (marketplace)
 */
export async function loadAllAgents(suiClient: SuiClient): Promise<Agent[]> {
  try {
    // Query all AgentRegistered events
    const response = await suiClient.queryEvents({
      query: {
        MoveEventType: `${CONTRACT_CONFIG.PACKAGE_ID}::identity_registry::AgentRegistered`,
      },
      limit: 50,
    })

    // Get unique agent IDs and owners from events
    const agentData = new Map<string, string>() // agent_id -> owner

    for (const event of response.data) {
      const parsedJson = event.parsedJson as any
      if (parsedJson?.agent_id) {
        agentData.set(String(parsedJson.agent_id), parsedJson.owner)
      }
    }

    // Load each agent
    const agentResults = await Promise.all(
      Array.from(agentData.entries()).map(async ([agentId, owner]): Promise<Agent | null> => {
        try {
          // Query for objects owned by this owner
          const objects = await suiClient.getOwnedObjects({
            owner,
            filter: {
              StructType: STRUCT_TYPES.AGENT,
            },
            options: {
              showContent: true,
              showType: true,
            },
          })

          // Find the agent with matching agent_id
          for (const obj of objects.data) {
            if (obj.data?.content?.dataType === 'moveObject') {
              const fields = (obj.data.content as any).fields

              if (String(fields.agent_id) === agentId) {
                let agent: Agent = {
                  ...parseAgentFields(fields, owner),
                  id: obj.data.objectId,
                }

                // Load metadata from Walrus
                agent = await loadAgentMetadata(agent)

                return agent
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching agent ${agentId}:`, error)
        }
        return null
      })
    )

    // Filter out null values
    return agentResults.filter((agent): agent is Agent => agent !== null)
  } catch (error) {
    console.error('Error loading all agents:', error)
    return []
  }
}

/**
 * Load reputation summary for an agent
 */
export async function loadAgentReputation(
  suiClient: SuiClient,
  agentId: string,
  accountAddress?: string
): Promise<Reputation> {
  try {
    const tx = new Transaction()
    tx.moveCall({
      target: `${CONTRACT_CONFIG.PACKAGE_ID}::reputation_registry::get_summary`,
      arguments: [tx.object(CONTRACT_CONFIG.REPUTATION_REGISTRY_ID), tx.pure.u64(agentId)],
    })

    const result = await suiClient.devInspectTransactionBlock({
      sender:
        accountAddress || '0x0000000000000000000000000000000000000000000000000000000000000000',
      transactionBlock: tx as any,
    })

    if (result.results && result.results[0] && result.results[0].returnValues) {
      const returnValues = result.results[0].returnValues
      const feedbackCountBytes = returnValues[0]?.[0]
      const averageScoreBytes = returnValues[1]?.[0]

      const feedbackCount = feedbackCountBytes
        ? bcs.u64().parse(new Uint8Array(feedbackCountBytes))
        : 0
      const averageScore = averageScoreBytes ? bcs.u8().parse(new Uint8Array(averageScoreBytes)) : 0

      return {
        feedbackCount: Number(feedbackCount),
        averageScore: Number(averageScore),
        feedbacks: [],
      }
    }
  } catch (error) {
    console.error('Error loading agent reputation:', error)
  }

  return {
    feedbackCount: 0,
    averageScore: 0,
    feedbacks: [],
  }
}

/**
 * Load feedback history for an agent
 */
export async function loadAgentFeedbackHistory(
  suiClient: SuiClient,
  agentId: string
): Promise<any[]> {
  try {
    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: `${CONTRACT_CONFIG.PACKAGE_ID}::reputation_registry::NewFeedback`,
      },
      limit: 100,
    })

    const agentFeedbacks = events.data
      .filter((event: any) => {
        const data = event.parsedJson
        return String(data.agent_id) === String(agentId)
      })
      .map((event: any) => ({
        agentId: event.parsedJson.agent_id,
        clientAddress: event.parsedJson.client_address,
        score: event.parsedJson.score,
        fileUri: event.parsedJson.file_uri,
        fileHash: event.parsedJson.file_hash,
        timestamp: event.timestampMs,
        transactionDigest: event.id.txDigest,
      }))
      .sort((a: any, b: any) => parseInt(b.timestamp) - parseInt(a.timestamp))

    return agentFeedbacks
  } catch (error) {
    console.error('Error loading feedback history:', error)
    return []
  }
}

/**
 * Load feedback data from Walrus for a given file URI
 */
export async function loadFeedbackData(fileUri: string): Promise<any> {
  try {
    if (fileUri && fileUri.startsWith('walrus://')) {
      return await readMetadataFromWalrus(extractBlobId(fileUri))
    }
  } catch (error) {
    console.error('Error loading feedback data from Walrus:', error)
    return { error: 'Failed to load feedback data' }
  }
  return null
}
