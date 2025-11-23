'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBox, faRotate, faImage } from '@fortawesome/free-solid-svg-icons'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { useState, useEffect } from 'react'
import { STRUCT_TYPES } from '@/config/contracts'
import { readMetadataFromWalrus, extractBlobId } from '@/utils/walrus'
import type { Agent, Endpoint } from '@/types'

interface AgentListProps {
  onSelectAgent?: (agent: Agent) => void
}

export default function AgentList({ onSelectAgent }: AgentListProps) {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (account) {
      loadAgents()
    }
  }, [account])

  const loadAgents = async () => {
    if (!account) return
    
    setLoading(true)
    try {
      // Get all objects owned by the user of type Agent
      const objects = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: {
          StructType: STRUCT_TYPES.AGENT,
        },
        options: {
          showContent: true,
          showType: true,
        },
      })

      const agentList: Agent[] = await Promise.all(
        objects.data
          .filter((obj) => obj.data?.content?.dataType === 'moveObject')
          .map(async (obj: any) => {
            const fields = obj.data.content.fields
            
            // Parse endpoints from the Move contract
            const endpoints: Endpoint[] = fields.endpoints?.map((ep: any) => ({
              name: ep.name || '',
              endpoint: ep.endpoint || '',
              version: ep.version || '',
            })) || []

            const agent: Agent = {
              id: obj.data.objectId,
              agentId: fields.agent_id,
              name: fields.name || '',
              description: fields.description || '',
              image: fields.image || '',
              tokenUri: fields.token_uri || '',
              endpoints,
              owner: account.address,
            }

            // Try to fetch additional metadata from Walrus if tokenUri exists
            // This will contain other extended fields
            if (agent.tokenUri && agent.tokenUri.startsWith('walrus://')) {
              try {
                const metadata = await readMetadataFromWalrus(extractBlobId(agent.tokenUri))
                agent.metadata = metadata
              } catch (error) {
                console.log(`Could not load metadata for agent ${agent.agentId}:`, error)
              }
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-12">
        <FontAwesomeIcon icon={faBox} className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Agents Found</h3>
        <p className="text-gray-600 mb-4">You haven't registered any agents yet.</p>
        <button
          onClick={loadAgents}
          className="text-primary hover:text-indigo-700 font-medium"
        >
          Refresh
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">My Agents</h2>
          <p className="text-gray-600">Manage agents you own on the blockchain</p>
        </div>
        <button
          onClick={loadAgents}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faRotate} className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => onSelectAgent?.(agent)}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer group transform hover:-translate-y-1"
          >
            {/* Agent Image */}
            <div className="relative aspect-square bg-gradient-to-br from-blue-100 to-indigo-200 overflow-hidden">
              {agent.image ? (
                <img
                  src={agent.image}
                  alt={agent.name || `Agent ${agent.agentId}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement
                    target.src = '/assets/fallback-agent.svg'
                    target.className = 'w-full h-full object-contain p-8 group-hover:scale-110 transition-transform duration-300'
                  }}
                />
              ) : (
                <img
                  src="/assets/fallback-agent.svg"
                  alt={agent.name || `Agent ${agent.agentId}`}
                  className="w-full h-full object-contain p-8 group-hover:scale-110 transition-transform duration-300"
                />
              )}
              
              {/* Owned Badge */}
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500 text-white shadow-lg backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5 animate-pulse"></span>
                  Owned
                </span>
              </div>
            </div>

            {/* Agent Info */}
            <div className="p-5">
              {/* Agent Name */}
              <div className="mb-2">
                <h3 className="text-xl font-bold text-gray-900 truncate">
                  {agent.name || `Agent ${agent.agentId}`}
                </h3>
              </div>

              {/* Agent ID */}
              <p className="text-xs text-gray-500 font-mono mb-3">
                ID: {agent.agentId}
              </p>

              {/* Owner */}
              <div className="mb-3 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-500">Owner</span>
                  <span className="font-mono text-gray-700">
                    {account?.address.slice(0, 6)}...{account?.address.slice(-4)}
                  </span>
                </div>
              </div>

              {/* Description */}
              {agent.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                  {agent.description}
                </p>
              )}

              {/* Token URI */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Token URI</label>
                <p className="text-gray-900 text-xs break-all mt-1">
                  {agent.tokenUri ? (
                    <a href={agent.tokenUri} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-indigo-700">
                      {agent.tokenUri.slice(0, 30)}...
                    </a>
                  ) : (
                    <span className="text-gray-400 italic">Not set</span>
                  )}
                </p>
              </div>

              {/* Metadata Stats */}
              <div className="flex items-center gap-2 mb-3">
                {agent.endpoints && agent.endpoints.length > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-md text-xs font-medium text-blue-700">
                    <span className="font-semibold">{agent.endpoints.length}</span>
                    <span>endpoint{agent.endpoints.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {agent.metadata?.supportedTrust && agent.metadata.supportedTrust.length > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 rounded-md text-xs font-medium text-purple-700">
                    <span className="font-semibold">{agent.metadata.supportedTrust.length}</span>
                    <span>trust</span>
                  </div>
                )}
              </div>

              {/* View Details Button */}
              <button className="mt-4 w-full bg-gradient-to-r from-primary to-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:from-indigo-600 hover:to-primary transition-all shadow-md hover:shadow-lg transform group-hover:scale-[1.02]">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
