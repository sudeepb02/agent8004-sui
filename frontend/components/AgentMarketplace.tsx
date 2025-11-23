'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faRotate,
  faSearch,
  faFaceFrown,
  faIdCard,
  faUser,
  faImage,
} from '@fortawesome/free-solid-svg-icons'
import { useSuiClient } from '@mysten/dapp-kit'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG, STRUCT_TYPES } from '@/config/contracts'
import type { Agent, Endpoint } from '@/types'
import { readMetadataFromWalrus, extractBlobId } from '@/utils/walrus'

interface AgentMarketplaceProps {
  onSelectAgent: (agent: Agent) => void
}

export default function AgentMarketplace({ onSelectAgent }: AgentMarketplaceProps) {
  const suiClient = useSuiClient()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadAllAgents()
  }, [])

  const loadAllAgents = async () => {
    setLoading(true)
    try {
      // Query all Agent objects by type instead of relying on events
      // This gets all Agent objects in the system
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

      // Now query for all Agent objects of the correct type
      // We'll use getDynamicFields on the registry to get agent object IDs
      const agentResults = await Promise.all(
        Array.from(agentData.keys()).map(async (agentId): Promise<Agent | null> => {
          try {
            // Query for objects with this agent_id
            const objects = await suiClient.getOwnedObjects({
              owner: agentData.get(agentId)!,
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
                  // Debug: Log the raw endpoint data
                  console.log('Raw agent fields:', fields)
                  console.log('Raw endpoints data:', fields.endpoints)

                  // Parse endpoints from the Move contract
                  const endpoints: Endpoint[] =
                    fields.endpoints?.map((ep: any) => {
                      // Handle both direct field access and potential wrapping
                      const name = ep.fields?.name || ep.name || ''
                      const endpoint = ep.fields?.endpoint || ep.endpoint || ''
                      const version = ep.fields?.version || ep.version || ''

                      console.log('Parsed endpoint:', { name, endpoint, version })

                      return {
                        name,
                        endpoint,
                        version,
                      }
                    }) || []

                  console.log('Final endpoints array:', endpoints)

                  const agent: Agent = {
                    id: obj.data.objectId,
                    agentId: fields.agent_id,
                    name: fields.name || '',
                    description: fields.description || '',
                    image: fields.image || '',
                    tokenUri: fields.token_uri || '',
                    endpoints,
                    owner: agentData.get(agentId) || '',
                  }

                  // Try to fetch additional metadata from Walrus if tokenUri exists
                  if (agent.tokenUri && agent.tokenUri.startsWith('walrus://')) {
                    try {
                      const metadata = await readMetadataFromWalrus(extractBlobId(agent.tokenUri))
                      agent.metadata = metadata
                    } catch (error) {
                      console.log(`Could not load metadata for agent ${agent.agentId}:`, error)
                    }
                  }

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

      // Filter out null values and set agents
      const agentList = agentResults.filter((agent): agent is Agent => agent !== null)
      setAgents(agentList)
    } catch (error) {
      console.error('Error loading agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAgents = agents.filter(
    (agent) =>
      agent.agentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Agent Marketplace</h2>
          <p className="text-gray-600">Browse and interact with registered agents</p>
        </div>
        <button
          onClick={loadAllAgents}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            <FontAwesomeIcon icon={faRotate} className="h-4 w-4" />
            Refresh
          </span>
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Search by Agent ID or Owner..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 pl-12 focus:border-transparent focus:ring-2 focus:ring-primary"
        />
        <FontAwesomeIcon
          icon={faSearch}
          className="absolute left-4 top-3.5 h-5 w-5 text-gray-400"
        />
      </div>

      {filteredAgents.length === 0 ? (
        <div className="rounded-lg bg-white py-12 text-center shadow-sm">
          <FontAwesomeIcon icon={faFaceFrown} className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">No Agents Found</h3>
          <p className="text-gray-600">
            {searchTerm ? 'Try a different search term' : 'No agents registered yet'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="group transform cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
              onClick={() => onSelectAgent(agent)}
            >
              {/* Agent Image */}
              <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-200">
                {agent.metadata?.image ? (
                  <img
                    src={agent.metadata.image}
                    alt={agent.metadata?.name || `Agent #${agent.agentId}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    onError={(e) => {
                      // Fallback if image fails to load
                      const target = e.target as HTMLImageElement
                      target.src = '/assets/fallback-agent.svg'
                      target.className =
                        'w-full h-full object-contain p-8 group-hover:scale-110 transition-transform duration-300'
                    }}
                  />
                ) : (
                  <img
                    src="/assets/fallback-agent.svg"
                    alt={agent.metadata?.name || `Agent #${agent.agentId}`}
                    className="h-full w-full object-contain p-8 transition-transform duration-300 group-hover:scale-110"
                  />
                )}

                {/* Active Badge */}
                <div className="absolute right-3 top-3">
                  <span className="inline-flex items-center rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
                    <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-white"></span>
                    Active
                  </span>
                </div>
              </div>

              {/* Agent Info */}
              <div className="p-5">
                {/* Agent Name */}
                <div className="mb-2">
                  <h3 className="truncate text-xl font-bold text-gray-900 transition-colors group-hover:text-primary">
                    {agent.name || `Agent ${agent.agentId}`}
                  </h3>
                </div>

                {/* Agent ID */}
                <p className="mb-3 flex items-center gap-1 font-mono text-xs text-gray-500">
                  <FontAwesomeIcon icon={faIdCard} className="h-3 w-3" />
                  ID: {agent.agentId}
                </p>

                {/* Owner */}
                {agent.owner && (
                  <div className="mb-3 border-b border-gray-100 pb-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-500">Owner</span>
                      <span className="font-mono text-gray-700">
                        {agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Description */}
                {agent.description && (
                  <p className="mb-3 line-clamp-3 text-sm text-gray-600">{agent.description}</p>
                )}

                {/* Endpoints Count */}
                {agent.endpoints && agent.endpoints.length > 0 && (
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                      <span className="font-semibold">{agent.endpoints.length}</span>
                      <span>endpoint{agent.endpoints.length !== 1 ? 's' : ''}</span>
                    </div>
                    {agent.metadata?.supportedTrust && agent.metadata.supportedTrust.length > 0 && (
                      <div className="flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                        <span className="font-semibold">
                          {agent.metadata.supportedTrust.length}
                        </span>
                        <span>
                          trust type{agent.metadata.supportedTrust.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* View Details Button */}
                <button className="mt-4 w-full transform rounded-lg bg-gradient-to-r from-primary to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-indigo-600 hover:to-primary hover:shadow-lg group-hover:scale-[1.02]">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
