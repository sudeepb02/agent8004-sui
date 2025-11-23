'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faStar,
  faCheckCircle,
  faGlobe,
  faShieldAlt,
  faCode,
  faPencil,
  faSave,
  faSpinner,
  faArrowsRotate,
  faPlus,
} from '@fortawesome/free-solid-svg-icons'
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { bcs } from '@mysten/sui/bcs'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG, MODULES } from '@/config/contracts'
import type { Agent, Reputation, Endpoint } from '@/types'
import {
  storeMetadataWithFlow,
  readMetadataFromWalrus,
  extractBlobId,
  type AgentMetadata,
} from '@/utils/walrus'

interface AgentDetailsProps {
  agent: Agent
  onBack: () => void
  onGiveFeedback: () => void
  onRequestValidation: () => void
  onAgentUpdate?: (updatedAgent: Agent) => void
}

type EditingField = 'name' | 'description' | 'image' | 'tokenUri' | null

export default function AgentDetails({
  agent,
  onBack,
  onGiveFeedback,
  onRequestValidation,
  onAgentUpdate,
}: AgentDetailsProps) {
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
  const [rawMetadata, setRawMetadata] = useState<AgentMetadata | null>(null)
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [feedbackHistory, setFeedbackHistory] = useState<any[]>([])
  const [loadingFeedbackHistory, setLoadingFeedbackHistory] = useState(false)
  const [feedbackData, setFeedbackData] = useState<{ [key: string]: any }>({})

  const isOwner = account?.address === agent.owner

  useEffect(() => {
    loadReputation()
    loadRawMetadata()
    loadFeedbackHistory()
  }, [agent])

  useEffect(() => {
    setCurrentAgent(agent)
  }, [agent])

  const loadRawMetadata = async () => {
    if (!currentAgent.tokenUri || !currentAgent.tokenUri.startsWith('walrus://')) {
      return
    }

    setLoadingMetadata(true)
    try {
      const metadata = await readMetadataFromWalrus(extractBlobId(currentAgent.tokenUri))
      setRawMetadata(metadata)
    } catch (error) {
      console.error('Error loading metadata from Walrus:', error)
    } finally {
      setLoadingMetadata(false)
    }
  }

  const loadFeedbackHistory = async () => {
    setLoadingFeedbackHistory(true)
    try {
      // Query events to find feedback for this agent
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${CONTRACT_CONFIG.PACKAGE_ID}::reputation_registry::NewFeedback`,
        },
        limit: 100,
      })

      // Filter events for the current agent
      const agentFeedbacks = events.data
        .filter((event: any) => {
          const data = event.parsedJson
          return String(data.agent_id) === String(agent.agentId)
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
        .sort((a: any, b: any) => parseInt(b.timestamp) - parseInt(a.timestamp)) // Most recent first

      setFeedbackHistory(agentFeedbacks)

      // Load feedback data from Walrus for each feedback
      agentFeedbacks.forEach(async (feedback: any) => {
        const hashKey = Array.isArray(feedback.fileHash)
          ? feedback.fileHash.join(',')
          : feedback.fileHash

        if (feedback.fileUri && feedback.fileUri.startsWith('walrus://')) {
          try {
            const metadata = await readMetadataFromWalrus(extractBlobId(feedback.fileUri))
            setFeedbackData((prev) => ({ ...prev, [hashKey]: metadata }))
          } catch (error) {
            console.error('Error loading feedback data from Walrus:', error)
            setFeedbackData((prev) => ({
              ...prev,
              [hashKey]: { error: 'Failed to load feedback data' },
            }))
          }
        }
      })
    } catch (error) {
      console.error('Error loading feedback history:', error)
    } finally {
      setLoadingFeedbackHistory(false)
    }
  }

  const loadReputation = async () => {
    setLoading(true)
    try {
      // Call the reputation registry to get feedback summary
      const tx = new Transaction()
      tx.moveCall({
        target: `${CONTRACT_CONFIG.PACKAGE_ID}::reputation_registry::get_summary`,
        arguments: [tx.object(CONTRACT_CONFIG.REPUTATION_REGISTRY_ID), tx.pure.u64(agent.agentId)],
      })

      const result = await suiClient.devInspectTransactionBlock({
        sender:
          account?.address || '0x0000000000000000000000000000000000000000000000000000000000000000',
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
            arguments: [tx.object(currentAgent.id), tx.pure.string(editValue)],
          })
          break
        case 'image':
          tx.moveCall({
            target: `${MODULES.IDENTITY_REGISTRY}::set_image`,
            arguments: [tx.object(currentAgent.id), tx.pure.string(editValue)],
          })
          break
        case 'tokenUri':
          tx.moveCall({
            target: `${MODULES.IDENTITY_REGISTRY}::set_token_uri`,
            arguments: [tx.object(currentAgent.id), tx.pure.string(editValue)],
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
          tx.pure(
            bcs
              .vector(bcs.u8())
              .serialize(new TextEncoder().encode(endpointForm.version || '1.0.0'))
          ),
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
        arguments: [tx.object(currentAgent.id), tx.pure.string(walrusUri)],
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

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center text-gray-600 transition-colors hover:text-gray-900"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="mr-2 h-5 w-5" />
        Back to Marketplace
      </button>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Agent Details (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Agent Header with Logo and Name */}
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <div className="flex items-start gap-6">
              {/* Larger Profile Image */}
              <div className="flex-shrink-0">
                {currentAgent.image ? (
                  <div className="h-32 w-32 overflow-hidden rounded-xl border-2 border-gray-200 shadow-md">
                    <img
                      src={currentAgent.image}
                      alt={currentAgent.name || `Agent ${currentAgent.agentId}`}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const fallbackDiv = document.createElement('div')
                        fallbackDiv.className =
                          'w-full h-full flex items-center justify-center text-white font-bold text-3xl bg-gradient-to-br from-blue-500 to-indigo-600'
                        fallbackDiv.textContent = currentAgent.agentId.slice(0, 2)
                        target.parentElement!.appendChild(fallbackDiv)
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-32 w-32 overflow-hidden rounded-xl border-2 border-gray-200 bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                    <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
                      {currentAgent.agentId.slice(0, 2)}
                    </div>
                  </div>
                )}
              </div>

              {/* Agent Name and Info */}
              <div className="min-w-0 flex-1">
                <h1 className="mb-2 text-3xl font-bold text-gray-900">
                  {currentAgent.name || `Agent ${currentAgent.agentId}`}
                </h1>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span className="rounded bg-gray-100 px-3 py-1 font-mono">
                    ID: {currentAgent.agentId}
                  </span>
                  {currentAgent.owner && (
                    <span className="rounded bg-gray-100 px-3 py-1 font-mono">
                      Owner: {currentAgent.owner.slice(0, 6)}...{currentAgent.owner.slice(-4)}
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 font-semibold text-green-700">
                    <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Details Sections */}
          <div className="space-y-4 rounded-xl bg-white p-6 shadow-lg">
            {/* Description */}
            {currentAgent.description && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Description</h3>
                  {isOwner && editingField !== 'description' && (
                    <button
                      onClick={() => handleStartEdit('description', currentAgent.description)}
                      className="text-xs text-primary hover:text-indigo-700"
                    >
                      <FontAwesomeIcon icon={faPencil} className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {editingField === 'description' ? (
                  <div className="space-y-2">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                      rows={3}
                      disabled={saving}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveField('description')}
                        disabled={saving || !editValue.trim()}
                        className="rounded bg-primary px-3 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {saving ? (
                          <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                        ) : (
                          <FontAwesomeIcon icon={faSave} />
                        )}{' '}
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-gray-700">
                    {currentAgent.description}
                  </p>
                )}
                <div className="mt-4 border-b border-gray-200"></div>
              </div>
            )}

            {/* Technical Information */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Agent Info</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="font-medium text-gray-500">Object ID</label>
                  <p className="break-all font-mono text-gray-900">{currentAgent.id}</p>
                </div>
                {currentAgent.image && (
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-gray-500">Image URI</label>
                      {isOwner && editingField !== 'image' && (
                        <button
                          onClick={() => handleStartEdit('image', currentAgent.image)}
                          className="text-primary hover:text-indigo-700"
                        >
                          <FontAwesomeIcon icon={faPencil} className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {editingField === 'image' ? (
                      <div className="mt-1 space-y-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-primary"
                          disabled={saving}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveField('image')}
                            disabled={saving || !editValue.trim()}
                            className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {saving ? (
                              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                            ) : (
                              'Save'
                            )}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <a
                        href={currentAgent.image}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-primary hover:text-indigo-700"
                      >
                        {currentAgent.image}
                      </a>
                    )}
                  </div>
                )}
                {currentAgent.tokenUri && (
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="font-medium text-gray-500">Agent URI</label>
                      {isOwner && editingField !== 'tokenUri' && (
                        <button
                          onClick={() => handleStartEdit('tokenUri', currentAgent.tokenUri)}
                          className="text-primary hover:text-indigo-700"
                        >
                          <FontAwesomeIcon icon={faPencil} className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {editingField === 'tokenUri' ? (
                      <div className="mt-1 space-y-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-primary"
                          disabled={saving}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveField('tokenUri')}
                            disabled={saving || !editValue.trim()}
                            className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {saving ? (
                              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                            ) : (
                              'Save'
                            )}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <a
                        href={currentAgent.tokenUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-primary hover:text-indigo-700"
                      >
                        {currentAgent.tokenUri}
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-4 border-b border-gray-200"></div>
            </div>

            {/* Endpoints */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center text-sm font-semibold text-gray-900">
                  <FontAwesomeIcon icon={faGlobe} className="mr-2 h-4 w-4 text-blue-600" />
                  Endpoints
                </h3>
                {isOwner && editingEndpointIndex === null && (
                  <button
                    onClick={() => setEditingEndpointIndex(-1)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-indigo-700"
                  >
                    <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
                    Add
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {currentAgent.endpoints?.map((endpoint, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-900">{endpoint.name}</span>
                        {endpoint.version && (
                          <span className="rounded bg-white px-2 py-0.5 text-xs text-gray-600">
                            v{endpoint.version}
                          </span>
                        )}
                      </div>
                      <p className="break-all font-mono text-xs text-gray-700">
                        {endpoint.endpoint}
                      </p>
                    </div>
                  </div>
                ))}

                {editingEndpointIndex === -1 && (
                  <div className="rounded border-2 border-primary bg-white p-3">
                    <h4 className="mb-2 text-xs font-semibold text-gray-900">Add New Endpoint</h4>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={endpointForm.name}
                        onChange={(e) => setEndpointForm({ ...endpointForm, name: e.target.value })}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-primary"
                        placeholder="API Name"
                        disabled={saving}
                      />
                      <input
                        type="text"
                        value={endpointForm.endpoint}
                        onChange={(e) =>
                          setEndpointForm({ ...endpointForm, endpoint: e.target.value })
                        }
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-primary"
                        placeholder="https://api.example.com/v1"
                        disabled={saving}
                      />
                      <input
                        type="text"
                        value={endpointForm.version}
                        onChange={(e) =>
                          setEndpointForm({ ...endpointForm, version: e.target.value })
                        }
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-primary"
                        placeholder="Version (e.g., 1.0.0)"
                        disabled={saving}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddEndpoint}
                          disabled={
                            saving || !endpointForm.name.trim() || !endpointForm.endpoint.trim()
                          }
                          className="rounded bg-primary px-3 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {saving ? (
                            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faPlus} /> Add
                            </>
                          )}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 border-b border-gray-200"></div>
            </div>

            {/* Trust Mechanisms */}
            {currentAgent.metadata?.supportedTrust &&
              currentAgent.metadata.supportedTrust.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center text-sm font-semibold text-gray-900">
                    <FontAwesomeIcon icon={faShieldAlt} className="mr-2 h-4 w-4 text-purple-600" />
                    Trust Mechanisms
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {currentAgent.metadata.supportedTrust.map((trust, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 text-xs font-semibold text-white"
                      >
                        {trust}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 border-b border-gray-200"></div>
                </div>
              )}

            {/* Raw Metadata from Walrus */}
            {currentAgent.tokenUri && currentAgent.tokenUri.startsWith('walrus://') && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                  Raw Metadata (from Walrus)
                </h3>
                {loadingMetadata ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                    Loading metadata...
                  </div>
                ) : rawMetadata ? (
                  <div className="rounded border border-gray-200 bg-gray-50 p-3">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs">
                      {JSON.stringify(rawMetadata, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No metadata available</p>
                )}
              </div>
            )}
          </div>

          {/* Feedback History */}
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                <FontAwesomeIcon icon={faStar} className="mr-2 h-5 w-5 text-yellow-500" />
                Feedback History
              </h2>
              <button
                onClick={loadFeedbackHistory}
                disabled={loadingFeedbackHistory}
                className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
              >
                <FontAwesomeIcon
                  icon={faArrowsRotate}
                  className={`mr-1 h-3 w-3 ${loadingFeedbackHistory ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>

            {loadingFeedbackHistory ? (
              <div className="flex items-center justify-center py-12">
                <FontAwesomeIcon
                  icon={faSpinner}
                  className="mr-2 h-8 w-8 animate-spin text-primary"
                />
                <span className="text-gray-600">Loading feedback history...</span>
              </div>
            ) : feedbackHistory.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
                <p className="text-gray-600">No feedback yet for this agent.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbackHistory.map((feedback, idx) => {
                  const hashKey = Array.isArray(feedback.fileHash)
                    ? feedback.fileHash.join(',')
                    : feedback.fileHash

                  // Calculate score color
                  const scoreColor =
                    feedback.score >= 80
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : feedback.score >= 60
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                        : 'bg-red-100 text-red-800 border-red-200'

                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-bold ${scoreColor}`}
                            >
                              <FontAwesomeIcon icon={faStar} className="h-3 w-3" />
                              {feedback.score}/100
                            </span>
                            <span className="text-xs text-gray-500">
                              #{feedbackHistory.length - idx}
                            </span>
                          </div>
                          <p className="mb-1 text-xs text-gray-600">
                            <span className="font-medium">From:</span>{' '}
                            <span className="font-mono">
                              {feedback.clientAddress.slice(0, 6)}...
                              {feedback.clientAddress.slice(-4)}
                            </span>
                          </p>
                          <p className="mb-2 text-xs text-gray-600">
                            <span className="font-medium">Date:</span>{' '}
                            {new Date(parseInt(feedback.timestamp)).toLocaleString()}
                          </p>
                          {feedback.transactionDigest && (
                            <a
                              href={`https://suiscan.xyz/testnet/tx/${feedback.transactionDigest}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              View Transaction →
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Feedback Content */}
                      {feedback.fileUri && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900">
                            View Feedback Details
                          </summary>
                          <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                            {feedbackData[hashKey] ? (
                              <div className="space-y-2 text-xs">
                                {feedbackData[hashKey].error ? (
                                  <p className="text-red-600">{feedbackData[hashKey].error}</p>
                                ) : (
                                  <>
                                    {feedbackData[hashKey].feedback && (
                                      <div>
                                        <p className="mb-1 font-medium text-gray-700">Feedback:</p>
                                        <div className="max-h-32 overflow-y-auto rounded border border-gray-300 bg-white p-2">
                                          <p className="whitespace-pre-wrap text-xs text-gray-900">
                                            {feedbackData[hashKey].feedback}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    {feedbackData[hashKey].score && (
                                      <p className="text-gray-600">
                                        <span className="font-medium">Score:</span>{' '}
                                        {feedbackData[hashKey].score}/100
                                      </p>
                                    )}
                                    {feedbackData[hashKey].client && (
                                      <p className="text-gray-600">
                                        <span className="font-medium">Client:</span>{' '}
                                        <span className="font-mono text-xs">
                                          {feedbackData[hashKey].client}
                                        </span>
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <FontAwesomeIcon
                                  icon={faSpinner}
                                  className="h-3 w-3 animate-spin"
                                />
                                Loading feedback details...
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Reputation & Actions (1/3 width) */}
        <div className="space-y-6">
          {/* Reputation Summary */}
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Review Summary</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50 p-5">
                  <div className="mb-3 flex items-center justify-center">
                    <FontAwesomeIcon icon={faStar} className="mr-2 h-8 w-8 text-yellow-500" />
                    <span className="text-4xl font-bold text-gray-900">
                      {reputation?.averageScore || 0}
                    </span>
                    <span className="ml-1 text-sm text-gray-500">/100</span>
                  </div>
                  <p className="text-center text-sm font-medium text-gray-600">Average Score</p>
                  <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all"
                      style={{ width: `${reputation?.averageScore || 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 text-center">
                  <span className="text-3xl font-bold text-gray-900">
                    {reputation?.feedbackCount || 0}
                  </span>
                  <p className="mt-1 text-sm font-medium text-gray-600">Total Reviews</p>
                </div>

                <button
                  onClick={loadReputation}
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  <FontAwesomeIcon icon={faArrowsRotate} className="mr-2 h-4 w-4" />
                  Refresh Score
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Actions</h2>
            <div className="space-y-3">
              <button
                onClick={onGiveFeedback}
                className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-primary to-indigo-600 px-4 py-3 font-semibold text-white shadow-md transition-all hover:from-indigo-600 hover:to-primary hover:shadow-lg"
              >
                <FontAwesomeIcon icon={faStar} className="mr-2 h-5 w-5" />
                Give Feedback
              </button>

              <button
                onClick={onRequestValidation}
                className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-secondary to-green-600 px-4 py-3 font-semibold text-white shadow-md transition-all hover:from-green-600 hover:to-secondary hover:shadow-lg"
              >
                <FontAwesomeIcon icon={faCheckCircle} className="mr-2 h-5 w-5" />
                Request Validation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
