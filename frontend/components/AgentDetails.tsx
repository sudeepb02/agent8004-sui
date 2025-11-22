'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faStar, faCheckCircle } from '@fortawesome/free-solid-svg-icons'
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG } from '@/config/contracts'
import type { Agent, Reputation } from '@/types'

interface AgentDetailsProps {
  agent: Agent
  onBack: () => void
  onGiveFeedback: () => void
  onRequestValidation: () => void
}

export default function AgentDetails({ agent, onBack, onGiveFeedback, onRequestValidation }: AgentDetailsProps) {
  const suiClient = useSuiClient()
  const account = useCurrentAccount()
  const [reputation, setReputation] = useState<Reputation | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadReputation()
  }, [agent])

  const loadReputation = async () => {
    setLoading(true)
    try {
      // Call the reputation registry to get feedback summary
      const tx = new Transaction()
      tx.moveCall({
        target: `${CONTRACT_CONFIG.PACKAGE_ID}::reputation_registry::get_summary`,
        arguments: [
          tx.object(CONTRACT_CONFIG.REPUTATION_REGISTRY_ID),
          tx.pure.u64(agent.agentId),
        ],
      })
      
      const result = await suiClient.devInspectTransactionBlock({
        sender: account?.address || '0x0',
        transactionBlock: tx as any,
      })

      // Parse the result (this is simplified, actual parsing depends on response structure)
      setReputation({
        feedbackCount: 0,
        averageScore: 0,
        feedbacks: [],
      })
    } catch (error) {
      console.error('Error loading reputation:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="w-5 h-5 mr-2" />
        Back to Marketplace
      </button>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-8 py-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-blue-700 w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl mr-6">
                {agent.agentId.slice(0, 2)}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Agent #{agent.agentId}</h1>
                <p className="text-blue-100 text-sm">Registered Agent Identity</p>
              </div>
            </div>
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-700 text-white">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              Active
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Basic Info */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Object ID</label>
                  <p className="text-gray-900 font-mono text-sm break-all">{agent.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Agent ID</label>
                  <p className="text-gray-900 font-mono text-sm">{agent.agentId}</p>
                </div>
                {agent.owner && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Owner</label>
                    <p className="text-gray-900 font-mono text-sm break-all">{agent.owner}</p>
                  </div>
                )}
                {agent.tokenUri && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Token URI</label>
                    <a
                      href={agent.tokenUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-indigo-700 text-sm break-all"
                    >
                      {agent.tokenUri}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Reputation */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Reputation</h2>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Average Score</span>
                      <div className="flex items-center">
                        <FontAwesomeIcon icon={faStar} className="w-5 h-5 text-yellow-500 mr-1" />
                        <span className="text-2xl font-bold text-gray-900">
                          {reputation?.averageScore || 0}
                        </span>
                        <span className="text-gray-500 ml-1">/100</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full transition-all"
                        style={{ width: `${reputation?.averageScore || 0}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Total Feedbacks</span>
                      <span className="text-2xl font-bold text-gray-900">
                        {reputation?.feedbackCount || 0}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={loadReputation}
                    className="w-full text-sm text-primary hover:text-indigo-700 font-medium"
                  >
                    Refresh Reputation
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={onGiveFeedback}
                className="flex items-center justify-center px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                <FontAwesomeIcon icon={faStar} className="w-5 h-5 mr-2" />
                Give Feedback
              </button>

              <button
                onClick={onRequestValidation}
                className="flex items-center justify-center px-6 py-3 bg-secondary text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5 mr-2" />
                Request Validation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
