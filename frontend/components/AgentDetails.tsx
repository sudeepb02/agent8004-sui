'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faStar, faCheckCircle, faImage, faGlobe, faShieldAlt, faCode } from '@fortawesome/free-solid-svg-icons'
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { bcs } from '@mysten/sui/bcs'
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
        sender: account?.address || '0x0000000000000000000000000000000000000000000000000000000000000000',
        transactionBlock: tx as any,
      })

      // Parse the result from return values
      if (result.results && result.results[0] && result.results[0].returnValues) {
        const returnValues = result.results[0].returnValues
        // returnValues[0] is feedback count (u64), returnValues[1] is average score (u8)
        const feedbackCountBytes = returnValues[0]?.[0]
        const averageScoreBytes = returnValues[1]?.[0]
        
        const feedbackCount = feedbackCountBytes 
          ? bcs.u64().parse(new Uint8Array(feedbackCountBytes))
          : 0
        const averageScore = averageScoreBytes
          ? bcs.u8().parse(new Uint8Array(averageScoreBytes))
          : 0
        
        setReputation({
          feedbackCount: Number(feedbackCount),
          averageScore: Number(averageScore),
          feedbacks: [],
        })
      } else {
        setReputation({
          feedbackCount: 0,
          averageScore: 0,
          feedbacks: [],
        })
      }
    } catch (error) {
      console.error('Error loading reputation:', error)
      setReputation({
        feedbackCount: 0,
        averageScore: 0,
        feedbacks: [],
      })
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

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Hero Section with Image */}
        <div className="relative">
          {/* Banner/Image */}
          <div className="relative h-72 bg-gradient-to-br from-blue-500 to-indigo-600 overflow-hidden">
            {agent.metadata?.image ? (
              <>
                <img
                  src={agent.metadata.image}
                  alt={agent.metadata?.name || `Agent #${agent.agentId}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FontAwesomeIcon icon={faImage} className="text-white/30 text-8xl" />
              </div>
            )}
            
            {/* Agent Avatar Overlay */}
            <div className="absolute bottom-0 left-8 transform translate-y-1/2">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 w-32 h-32 rounded-2xl flex items-center justify-center text-white font-bold text-5xl shadow-2xl border-4 border-white">
                {agent.agentId.slice(0, 2)}
              </div>
            </div>

            {/* Status Badge */}
            <div className="absolute top-6 right-6">
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-green-500 text-white shadow-lg backdrop-blur-sm">
                <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
                Active
              </span>
            </div>
          </div>

          {/* Agent Name and ID */}
          <div className="pt-20 px-8 pb-6 bg-white">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  {agent.metadata?.name || `Agent #${agent.agentId}`}
                </h1>
                <div className="flex items-center gap-3 text-gray-600">
                  <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-lg">
                    ID: {agent.agentId}
                  </span>
                  {agent.owner && (
                    <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-lg">
                      Owner: {agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {agent.metadata?.description && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700 leading-relaxed">
                  {agent.metadata.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Content Sections */}
        <div className="px-8 pb-8">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Endpoints */}
              {agent.metadata?.endpoints && agent.metadata.endpoints.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <FontAwesomeIcon icon={faGlobe} className="w-5 h-5 mr-3 text-blue-600" />
                    Endpoints
                  </h2>
                  <div className="space-y-3">
                    {agent.metadata.endpoints.map((endpoint, idx) => (
                      <div key={idx} className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-semibold text-gray-900">{endpoint.name}</span>
                          {endpoint.version && (
                            <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full font-medium">
                              v{endpoint.version}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 font-mono break-all">
                          {endpoint.endpoint}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Supported Trust */}
              {agent.metadata?.supportedTrust && agent.metadata.supportedTrust.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <FontAwesomeIcon icon={faShieldAlt} className="w-5 h-5 mr-3 text-purple-600" />
                    Trust Mechanisms
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {agent.metadata.supportedTrust.map((trust, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
                      >
                        {trust}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Registrations */}
              {agent.metadata?.registrations && agent.metadata.registrations.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <FontAwesomeIcon icon={faCode} className="w-5 h-5 mr-3 text-green-600" />
                    Registrations
                  </h2>
                  <div className="space-y-3">
                    {agent.metadata.registrations.map((reg, idx) => (
                      <div key={idx} className="p-4 bg-green-50 rounded-lg border border-green-100">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <label className="text-gray-500 font-medium">Agent ID</label>
                            <p className="text-gray-900 font-mono">{reg.agentId}</p>
                          </div>
                          <div>
                            <label className="text-gray-500 font-medium">Registry</label>
                            <p className="text-gray-900 font-mono text-xs break-all">{reg.agentRegistry}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Details */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Technical Details</h2>
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="text-sm font-medium text-gray-500">Object ID</label>
                    <p className="text-gray-900 font-mono text-sm break-all mt-1">{agent.id}</p>
                  </div>
                  {agent.tokenUri && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">Token URI</label>
                      <a
                        href={agent.tokenUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-indigo-700 text-sm break-all mt-1 block"
                      >
                        {agent.tokenUri}
                      </a>
                    </div>
                  )}
                  {agent.metadata?.type && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">Type</label>
                      <p className="text-gray-900 text-sm break-all mt-1">{agent.metadata.type}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Reputation & Actions */}
            <div className="space-y-6">
              {/* Reputation Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Reputation</h2>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-5 border border-yellow-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">Average Score</span>
                        <div className="flex items-center">
                          <FontAwesomeIcon icon={faStar} className="w-6 h-6 text-yellow-500 mr-2" />
                          <span className="text-3xl font-bold text-gray-900">
                            {reputation?.averageScore || 0}
                          </span>
                          <span className="text-gray-500 ml-1 text-sm">/100</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-yellow-400 to-orange-500 h-3 rounded-full transition-all shadow-sm"
                          style={{ width: `${reputation?.averageScore || 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Total Feedbacks</span>
                        <span className="text-3xl font-bold text-gray-900">
                          {reputation?.feedbackCount || 0}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={loadReputation}
                      className="w-full text-sm text-primary hover:text-indigo-700 font-medium py-2"
                    >
                      Refresh Reputation
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Actions</h2>
                <div className="space-y-3">
                  <button
                    onClick={onGiveFeedback}
                    className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-primary to-indigo-600 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-primary transition-all shadow-md hover:shadow-lg"
                  >
                    <FontAwesomeIcon icon={faStar} className="w-5 h-5 mr-2" />
                    Give Feedback
                  </button>

                  <button
                    onClick={onRequestValidation}
                    className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-secondary to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-secondary transition-all shadow-md hover:shadow-lg"
                  >
                    <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5 mr-2" />
                    Request Validation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
