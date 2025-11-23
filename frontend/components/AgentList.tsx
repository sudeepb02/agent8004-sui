'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBox, faRotate, faImage } from '@fortawesome/free-solid-svg-icons'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { useState, useEffect } from 'react'
import { loadAgentsByOwner } from '@/utils/agentUtils'
import type { Agent } from '@/types'

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
      const agentList = await loadAgentsByOwner(suiClient, account.address)
      setAgents(agentList)
    } catch (error) {
      console.error('Error loading agents:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="py-12 text-center">
        <FontAwesomeIcon icon={faBox} className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <h3 className="mb-2 text-lg font-medium text-gray-900">No Agents Found</h3>
        <p className="mb-4 text-gray-600">You haven't registered any agents yet.</p>
        <button onClick={loadAgents} className="font-medium text-primary hover:text-indigo-700">
          Refresh
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">My Agents</h2>
          <p className="text-gray-600">Manage agents you own on the blockchain</p>
        </div>
        <button
          onClick={loadAgents}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <FontAwesomeIcon icon={faRotate} className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => onSelectAgent?.(agent)}
            className="group transform cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
          >
            {/* Agent Image */}
            <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-200">
              {agent.image ? (
                <img
                  src={agent.image}
                  alt={agent.name || `Agent ${agent.agentId}`}
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
                  alt={agent.name || `Agent ${agent.agentId}`}
                  className="h-full w-full object-contain p-8 transition-transform duration-300 group-hover:scale-110"
                />
              )}

              {/* Owned Badge */}
              <div className="absolute right-3 top-3">
                <span className="inline-flex items-center rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
                  <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-white"></span>
                  Owned
                </span>
              </div>
            </div>

            {/* Agent Info */}
            <div className="p-5">
              {/* Agent Name */}
              <div className="mb-2">
                <h3 className="truncate text-xl font-bold text-gray-900">
                  {agent.name || `Agent ${agent.agentId}`}
                </h3>
              </div>

              {/* Agent ID */}
              <p className="mb-3 font-mono text-xs text-gray-500">ID: {agent.agentId}</p>

              {/* Owner */}
              <div className="mb-3 border-b border-gray-100 pb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-500">Owner</span>
                  <span className="font-mono text-gray-700">
                    {account?.address.slice(0, 6)}...{account?.address.slice(-4)}
                  </span>
                </div>
              </div>

              {/* Description */}
              {agent.description && (
                <p className="mb-3 line-clamp-3 text-sm text-gray-600">{agent.description}</p>
              )}

              {/* Token URI */}
              <div className="mb-3 rounded-lg bg-gray-50 p-3">
                <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Token URI
                </label>
                <p className="mt-1 break-all text-xs text-gray-900">
                  {agent.tokenUri ? (
                    <a
                      href={agent.tokenUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-indigo-700"
                    >
                      {agent.tokenUri.slice(0, 30)}...
                    </a>
                  ) : (
                    <span className="italic text-gray-400">Not set</span>
                  )}
                </p>
              </div>

              {/* Metadata Stats */}
              <div className="mb-3 flex items-center gap-2">
                {agent.endpoints && agent.endpoints.length > 0 && (
                  <div className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                    <span className="font-semibold">{agent.endpoints.length}</span>
                    <span>endpoint{agent.endpoints.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {agent.metadata?.supportedTrust && agent.metadata.supportedTrust.length > 0 && (
                  <div className="flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                    <span className="font-semibold">{agent.metadata.supportedTrust.length}</span>
                    <span>trust</span>
                  </div>
                )}
              </div>

              {/* View Details Button */}
              <button className="mt-4 w-full transform rounded-lg bg-gradient-to-r from-primary to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-indigo-600 hover:to-primary hover:shadow-lg group-hover:scale-[1.02]">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
