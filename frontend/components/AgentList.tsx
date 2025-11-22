'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBox, faRotate } from '@fortawesome/free-solid-svg-icons'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { useState, useEffect } from 'react'
import { STRUCT_TYPES } from '@/config/contracts'

interface Agent {
  id: string
  agentId: string
  tokenUri: string
  owner: string
}

export default function AgentList() {
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

      const agentList: Agent[] = objects.data
        .filter((obj) => obj.data?.content?.dataType === 'moveObject')
        .map((obj: any) => {
          const fields = obj.data.content.fields
          return {
            id: obj.data.objectId,
            agentId: fields.agent_id,
            tokenUri: fields.token_uri,
            owner: fields.owner,
          }
        })

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {agent.agentId.slice(0, 2)}
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                Owned
              </span>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Agent #{agent.agentId}
              </h3>
              <p className="text-xs text-gray-500 font-mono break-all">{agent.id}</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Token URI</label>
                <p className="text-gray-900 break-all mt-1">
                  {agent.tokenUri ? (
                    <a href={agent.tokenUri} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-indigo-700">
                      {agent.tokenUri.slice(0, 40)}...
                    </a>
                  ) : (
                    <span className="text-gray-400 italic">Not set</span>
                  )}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Owner</label>
                <p className="text-gray-900 font-mono text-xs break-all mt-1">
                  {agent.owner.slice(0, 10)}...{agent.owner.slice(-8)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
