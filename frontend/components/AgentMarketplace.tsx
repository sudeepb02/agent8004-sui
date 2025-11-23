'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRotate, faSearch, faFaceFrown, faIdCard, faUser, faImage } from '@fortawesome/free-solid-svg-icons'
import { useSuiClient } from '@mysten/dapp-kit'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG, STRUCT_TYPES } from '@/config/contracts'
import type { Agent } from '@/types'
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
      // Query all Agent objects from the identity registry
      const { data } = await suiClient.queryEvents({
        query: {
          MoveEventType: `${CONTRACT_CONFIG.PACKAGE_ID}::identity_registry::AgentRegistered`,
        },
        limit: 50,
      })

      const agentIds = new Set<string>()
      const agentDataMap = new Map<string, any>()
      
      for (const event of data) {
        const parsedJson = event.parsedJson as any
        if (parsedJson?.agent_id) {
          agentIds.add(parsedJson.agent_id)
          agentDataMap.set(parsedJson.agent_id, {
            objectId: parsedJson.agent_object_id,
            owner: parsedJson.owner,
          })
        }
      }

      // For now, we'll fetch agents from events and try to load metadata
      const agentList: Agent[] = await Promise.all(
        Array.from(agentIds).map(async (id) => {
          const agentData = agentDataMap.get(id)
          const agent: Agent = {
            id: agentData?.objectId || `agent_${id}`,
            agentId: id,
            tokenUri: '',
            owner: agentData?.owner || '',
          }

          // Try to fetch metadata from Walrus if tokenUri exists
          try {
            if (agent.tokenUri && agent.tokenUri.startsWith('walrus://')) {
              const metadata = await readMetadataFromWalrus(extractBlobId(agent.tokenUri))
              agent.metadata = metadata
            }
          } catch (error) {
            console.log(`Could not load metadata for agent ${id}:`, error)
          }

          return agent
        })
      )

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
      agent.metadata?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.metadata?.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Agent Marketplace</h2>
          <p className="text-gray-600">Browse and interact with registered agents</p>
        </div>
        <button
          onClick={loadAllAgents}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <FontAwesomeIcon icon={faRotate} className="w-4 h-4" />
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
          className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <FontAwesomeIcon
          icon={faSearch}
          className="absolute left-4 top-3.5 w-5 h-5 text-gray-400"
        />
      </div>

      {filteredAgents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <FontAwesomeIcon icon={faFaceFrown} className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Agents Found</h3>
          <p className="text-gray-600">
            {searchTerm ? 'Try a different search term' : 'No agents registered yet'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer group transform hover:-translate-y-1"
              onClick={() => onSelectAgent(agent)}
            >
              {/* Agent Image */}
              <div className="relative aspect-square bg-gradient-to-br from-blue-100 to-indigo-200 overflow-hidden">
                {agent.metadata?.image ? (
                  <img
                    src={agent.metadata.image}
                    alt={agent.metadata?.name || `Agent #${agent.agentId}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      // Fallback if image fails to load
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-24 h-24 mx-auto rounded-full flex items-center justify-center text-white font-bold text-4xl shadow-lg mb-3">
                        {agent.agentId.slice(0, 2)}
                      </div>
                      <FontAwesomeIcon icon={faImage} className="text-gray-400 text-3xl" />
                    </div>
                  </div>
                )}
                
                {/* Active Badge */}
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500 text-white shadow-lg backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5 animate-pulse"></span>
                    Active
                  </span>
                </div>
              </div>

              {/* Agent Info */}
              <div className="p-5">
                {/* Agent Name and ID */}
                <div className="mb-3">
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors mb-1 truncate">
                    {agent.metadata?.name || `Agent #${agent.agentId}`}
                  </h3>
                  <p className="text-sm text-gray-500 font-mono flex items-center gap-1">
                    <FontAwesomeIcon icon={faIdCard} className="w-3 h-3" />
                    ID: {agent.agentId}
                  </p>
                </div>

                {/* Description */}
                {agent.metadata?.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5rem]">
                    {agent.metadata.description}
                  </p>
                )}

                {/* Endpoints Count */}
                {agent.metadata?.endpoints && agent.metadata.endpoints.length > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-md text-xs font-medium text-blue-700">
                      <span className="font-semibold">{agent.metadata.endpoints.length}</span>
                      <span>endpoint{agent.metadata.endpoints.length !== 1 ? 's' : ''}</span>
                    </div>
                    {agent.metadata.supportedTrust && agent.metadata.supportedTrust.length > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 rounded-md text-xs font-medium text-purple-700">
                        <span className="font-semibold">{agent.metadata.supportedTrust.length}</span>
                        <span>trust type{agent.metadata.supportedTrust.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Owner */}
                {agent.owner && (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="font-medium">Owner</span>
                      <span className="font-mono">
                        {agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}
                      </span>
                    </div>
                  </div>
                )}

                {/* View Details Button */}
                <button className="mt-4 w-full bg-gradient-to-r from-primary to-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:from-indigo-600 hover:to-primary transition-all shadow-md hover:shadow-lg transform group-hover:scale-[1.02]">
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
