'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faStar, faCheckCircle, faImage, faGlobe, faShieldAlt, faCode, faPencil, faSave, faTimes, faSpinner, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { bcs } from '@mysten/sui/bcs'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG, MODULES } from '@/config/contracts'
import type { Agent, Reputation, Endpoint } from '@/types'
import { storeMetadataWithFlow, readMetadataFromWalrus, extractBlobId, type AgentMetadata } from '@/utils/walrus'

interface AgentDetailsProps {
  agent: Agent
  onBack: () => void
  onGiveFeedback: () => void
  onRequestValidation: () => void
  onAgentUpdate?: (updatedAgent: Agent) => void
}

type EditingField = 'name' | 'description' | 'image' | 'tokenUri' | null

export default function AgentDetails({ agent, onBack, onGiveFeedback, onRequestValidation, onAgentUpdate }: AgentDetailsProps) {
  const suiClient = useSuiClient()
  const account = useCurrentAccount()
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const [reputation, setReputation] = useState<Reputation | null>(null)
  const [loading, setLoading] = useState(false)
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentAgent, setCurrentAgent] = useState<Agent>(agent)
  const [editingEndpointIndex, setEditingEndpointIndex] = useState<number | null>(null)
  const [endpointForm, setEndpointForm] = useState({ name: '', endpoint: '', version: '' })

  const isOwner = account?.address === agent.owner

  useEffect(() => {
    loadReputation()
  }, [agent])

  useEffect(() => {
    setCurrentAgent(agent)
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

  const handleStartEdit = (field: EditingField, currentValue: string) => {
    setEditingField(field)
    setEditValue(currentValue)
  }

  const handleCancelEdit = () => {
    setEditingField(null)
    setEditValue('')
    setEditingEndpointIndex(null)
    setEndpointForm({ name: '', endpoint: '', version: '' })
  }

  const handleSaveField = async (field: EditingField) => {
    if (!field || !editValue.trim() || !account) return
    
    setSaving(true)
    try {
      const tx = new Transaction()

      // Update the appropriate field on-chain
      switch (field) {
        case 'name':
          // Name is stored in contract - no metadata update needed
          break
        case 'description':
          tx.moveCall({
            target: `${MODULES.IDENTITY_REGISTRY}::set_description`,
            arguments: [
              tx.object(currentAgent.id),
              tx.pure.string(editValue),
            ],
          })
          break
        case 'image':
          tx.moveCall({
            target: `${MODULES.IDENTITY_REGISTRY}::set_image`,
            arguments: [
              tx.object(currentAgent.id),
              tx.pure.string(editValue),
            ],
          })
          break
        case 'tokenUri':
          tx.moveCall({
            target: `${MODULES.IDENTITY_REGISTRY}::set_token_uri`,
            arguments: [
              tx.object(currentAgent.id),
              tx.pure.string(editValue),
            ],
          })
          break
      }

      await new Promise<void>((resolve, reject) => {
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => {
              // Update local state
              const updatedAgent = { ...currentAgent, [field]: editValue }
              setCurrentAgent(updatedAgent)
              if (onAgentUpdate) onAgentUpdate(updatedAgent)
              setEditingField(null)
              setEditValue('')
              resolve()
            },
            onError: (error) => {
              console.error('Failed to update field:', error)
              alert('Failed to update field. Please try again.')
              reject(error)
            },
          }
        )
      })
    } catch (error) {
      console.error('Error saving field:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleAddEndpoint = async () => {
    if (!endpointForm.name.trim() || !endpointForm.endpoint.trim() || !account) return

    setSaving(true)
    try {
      const tx = new Transaction()
      tx.moveCall({
        target: `${MODULES.IDENTITY_REGISTRY}::add_endpoint`,
        arguments: [
          tx.object(currentAgent.id),
          tx.pure(bcs.vector(bcs.u8()).serialize(new TextEncoder().encode(endpointForm.name))),
          tx.pure(bcs.vector(bcs.u8()).serialize(new TextEncoder().encode(endpointForm.endpoint))),
          tx.pure(bcs.vector(bcs.u8()).serialize(new TextEncoder().encode(endpointForm.version || '1.0.0'))),
        ],
      })

      await new Promise<void>((resolve, reject) => {
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => {
              const newEndpoint: Endpoint = {
                name: endpointForm.name,
                endpoint: endpointForm.endpoint,
                version: endpointForm.version || '1.0.0',
              }
              const updatedAgent = {
                ...currentAgent,
                endpoints: [...currentAgent.endpoints, newEndpoint],
              }
              setCurrentAgent(updatedAgent)
              if (onAgentUpdate) onAgentUpdate(updatedAgent)
              setEndpointForm({ name: '', endpoint: '', version: '' })
              setEditingEndpointIndex(null)
              resolve()
            },
            onError: (error) => {
              console.error('Failed to add endpoint:', error)
              alert('Failed to add endpoint. Please try again.')
              reject(error)
            },
          }
        )
      })
    } catch (error) {
      console.error('Error adding endpoint:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateMetadataField = async (fieldName: string, value: any) => {
    if (!account || !currentAgent.tokenUri) {
      alert('Token URI must be set before updating metadata fields')
      return
    }

    setSaving(true)
    try {
      // Read existing metadata from Walrus
      let existingMetadata: AgentMetadata | null = null
      if (currentAgent.tokenUri.startsWith('walrus://')) {
        try {
          existingMetadata = await readMetadataFromWalrus(extractBlobId(currentAgent.tokenUri))
        } catch (error) {
          console.log('No existing metadata, creating new')
        }
      }

      // Create updated metadata
      const updatedMetadata: AgentMetadata = {
        type: existingMetadata?.type || 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name: currentAgent.name,
        description: currentAgent.description,
        image: currentAgent.image,
        endpoints: currentAgent.endpoints,
        ...existingMetadata,
        [fieldName]: value,
      }

      // Store updated metadata on Walrus
      const { walrusUri } = await storeMetadataWithFlow(
        updatedMetadata,
        account.address,
        signAndExecute,
        suiClient
      )

      // Update token URI on-chain
      const tx = new Transaction()
      tx.moveCall({
        target: `${MODULES.IDENTITY_REGISTRY}::set_token_uri`,
        arguments: [
          tx.object(currentAgent.id),
          tx.pure.string(walrusUri),
        ],
      })

      await new Promise<void>((resolve, reject) => {
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => {
              const updatedAgent = {
                ...currentAgent,
                tokenUri: walrusUri,
                metadata: updatedMetadata,
              }
              setCurrentAgent(updatedAgent)
              if (onAgentUpdate) onAgentUpdate(updatedAgent)
              resolve()
            },
            onError: (error) => {
              console.error('Failed to update token URI:', error)
              reject(error)
            },
          }
        )
      })

      alert('Metadata updated successfully!')
    } catch (error) {
      console.error('Error updating metadata:', error)
      alert('Failed to update metadata. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const renderEditableField = (
    label: string,
    field: EditingField,
    value: string,
    isMultiline: boolean = false
  ) => {
    const isEditing = editingField === field

    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">{label}</h2>
          {isOwner && !isEditing && (
            <button
              onClick={() => handleStartEdit(field, value)}
              className="text-primary hover:text-indigo-700 transition-colors"
              title="Edit"
            >
              <FontAwesomeIcon icon={faPencil} className="w-4 h-4" />
            </button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-3">
            {isMultiline ? (
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={4}
                disabled={saving}
              />
            ) : (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={saving}
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveField(field)}
                disabled={saving || !editValue.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <><FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><FontAwesomeIcon icon={faSave} className="w-4 h-4" /> Save</>
                )}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faTimes} className="w-4 h-4 mr-2" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-gray-50 rounded-lg">
            {field === 'image' || field === 'tokenUri' ? (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-indigo-700 text-sm break-all"
              >
                {value}
              </a>
            ) : (
              <p className="text-gray-700 leading-relaxed">{value}</p>
            )}
          </div>
        )}
      </div>
    )
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
            {currentAgent.image ? (
              <>
                <img
                  src={currentAgent.image}
                  alt={currentAgent.name || `Agent ${currentAgent.agentId}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement
                    target.src = '/assets/fallback-agent.svg'
                    target.className = 'w-full h-full object-contain p-16'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              </>
            ) : (
              <img
                src="/assets/fallback-agent.svg"
                alt={currentAgent.name || `Agent ${currentAgent.agentId}`}
                className="w-full h-full object-contain p-16"
              />
            )}
            
            {/* Agent Avatar Overlay */}
            <div className="absolute bottom-0 left-8 transform translate-y-1/2">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 w-32 h-32 rounded-2xl flex items-center justify-center text-white font-bold text-5xl shadow-2xl border-4 border-white">
                {currentAgent.agentId.slice(0, 2)}
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
                  {currentAgent.name || `Agent ${currentAgent.agentId}`}
                </h1>
                <div className="flex items-center gap-3 text-gray-600">
                  <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-lg">
                    ID: {currentAgent.agentId}
                  </span>
                  {currentAgent.owner && (
                    <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-lg">
                      Owner: {currentAgent.owner.slice(0, 6)}...{currentAgent.owner.slice(-4)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="px-8 pb-8">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Agent Description */}
              {currentAgent.description && renderEditableField('Agent Description', 'description', currentAgent.description, true)}

              {/* Image URI */}
              {currentAgent.image && renderEditableField('Image URI', 'image', currentAgent.image)}

              {/* Token URI */}
              {currentAgent.tokenUri && renderEditableField('Token URI', 'tokenUri', currentAgent.tokenUri)}

              {/* Endpoints */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <FontAwesomeIcon icon={faGlobe} className="w-5 h-5 mr-3 text-blue-600" />
                    Endpoints
                  </h2>
                  {isOwner && editingEndpointIndex === null && (
                    <button
                      onClick={() => setEditingEndpointIndex(-1)}
                      className="text-primary hover:text-indigo-700 transition-colors flex items-center gap-1 text-sm"
                      title="Add Endpoint"
                    >
                      <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                      Add
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {currentAgent.endpoints?.map((endpoint, idx) => (
                    <div key={idx} className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</label>
                          <p className="text-sm font-semibold text-gray-900 mt-1">{endpoint.name}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Endpoint</label>
                          <p className="text-sm text-gray-700 font-mono break-all mt-1">
                            {endpoint.endpoint}
                          </p>
                        </div>
                        {endpoint.version && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Version</label>
                            <p className="text-sm text-gray-900 mt-1">v{endpoint.version}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Add Endpoint Form */}
                  {editingEndpointIndex === -1 && (
                    <div className="p-4 bg-white border-2 border-primary rounded-lg">
                      <h3 className="font-semibold text-gray-900 mb-3">Add New Endpoint</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</label>
                          <input
                            type="text"
                            value={endpointForm.name}
                            onChange={(e) => setEndpointForm({ ...endpointForm, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent mt-1"
                            placeholder="API Name"
                            disabled={saving}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Endpoint URL</label>
                          <input
                            type="text"
                            value={endpointForm.endpoint}
                            onChange={(e) => setEndpointForm({ ...endpointForm, endpoint: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent mt-1"
                            placeholder="https://api.example.com/v1"
                            disabled={saving}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Version</label>
                          <input
                            type="text"
                            value={endpointForm.version}
                            onChange={(e) => setEndpointForm({ ...endpointForm, version: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent mt-1"
                            placeholder="1.0.0"
                            disabled={saving}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleAddEndpoint}
                            disabled={saving || !endpointForm.name.trim() || !endpointForm.endpoint.trim()}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            {saving ? (
                              <><FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" /> Adding...</>
                            ) : (
                              <><FontAwesomeIcon icon={faPlus} className="w-4 h-4" /> Add Endpoint</>
                            )}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                          >
                            <FontAwesomeIcon icon={faTimes} className="w-4 h-4 mr-2" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Supported Trust */}
              {currentAgent.metadata?.supportedTrust && currentAgent.metadata.supportedTrust.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <FontAwesomeIcon icon={faShieldAlt} className="w-5 h-5 mr-3 text-purple-600" />
                    Trust Mechanisms
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {currentAgent.metadata.supportedTrust.map((trust, idx) => (
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
              {currentAgent.metadata?.registrations && currentAgent.metadata.registrations.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <FontAwesomeIcon icon={faCode} className="w-5 h-5 mr-3 text-green-600" />
                    Registrations
                  </h2>
                  <div className="space-y-3">
                    {currentAgent.metadata.registrations.map((reg, idx) => (
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

              {/* Additional Technical Details */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Additional Details</h2>
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="text-sm font-medium text-gray-500">Object ID</label>
                    <p className="text-gray-900 font-mono text-sm break-all mt-1">{currentAgent.id}</p>
                  </div>
                  {currentAgent.metadata?.type && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">Type</label>
                      <p className="text-gray-900 text-sm break-all mt-1">{currentAgent.metadata.type}</p>
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
