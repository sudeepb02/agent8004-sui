'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRotate, faSearch, faFaceFrown, faIdCard, faUser } from '@fortawesome/free-solid-svg-icons'
import { useSuiClient } from '@mysten/dapp-kit'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG, STRUCT_TYPES } from '@/config/contracts'
import type { Agent } from '@/types'

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
      
      for (const event of data) {
        const parsedJson = event.parsedJson as any
        if (parsedJson?.agent_id) {
          agentIds.add(parsedJson.agent_id)
        }
      }

      // For now, we'll fetch agents from events
      // In production, you'd want to query objects directly
      const agentList: Agent[] = Array.from(agentIds).map((id, index) => ({
        id: `agent_${id}`,
        agentId: id,
        tokenUri: '',
        owner: '',
      }))

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
      agent.owner.toLowerCase().includes(searchTerm.toLowerCase())
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => onSelectAgent(agent)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {agent.agentId.slice(0, 2)}
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                Agent #{agent.agentId}
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-600">
                  <FontAwesomeIcon icon={faIdCard} className="w-4 h-4 mr-2" />
                  ID: {agent.id.slice(0, 10)}...
                </div>
                {agent.owner && (
                  <div className="flex items-center text-gray-600">
                    <FontAwesomeIcon icon={faUser} className="w-4 h-4 mr-2" />
                    Owner: {agent.owner.slice(0, 8)}...
                  </div>
                )}
              </div>

              <button className="mt-4 w-full bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                View Details
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
