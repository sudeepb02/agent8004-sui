'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDatabase, faSpinner, faRobot, faLink, faKey, faInfoCircle, faTag, faCloudUploadAlt, faChevronDown, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons'
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG, MODULES, STRUCT_TYPES } from '@/config/contracts'
import { storeMetadataWithFlow, type AgentMetadata, type Endpoint, readMetadataFromWalrus } from '@/utils/walrus'

interface Agent {
  id: string
  agentId: string
  name: string
  description: string
  image: string
  tokenUri: string
}

export default function SetMetadata() {
  const account = useCurrentAccount()
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [tokenUri, setTokenUri] = useState('')
  const [endpointName, setEndpointName] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [endpointVersion, setEndpointVersion] = useState('1.0.0')
  const [metadataJson, setMetadataJson] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadingToWalrus, setUploadingToWalrus] = useState(false)
  const [result, setResult] = useState<string>('')
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const suiClient = useSuiClient()

  useEffect(() => {
    if (account) {
      loadAgents()
    }
  }, [account])

  const loadAgents = async () => {
    if (!account) return
    
    try {
      const objects = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: {
          StructType: STRUCT_TYPES.AGENT,
        },
        options: {
          showContent: true,
        },
      })

      const agentList: Agent[] = objects.data
        .filter((obj) => obj.data?.content?.dataType === 'moveObject')
        .map((obj: any) => ({
          id: obj.data.objectId,
          agentId: obj.data.content.fields.agent_id,
          name: obj.data.content.fields.name,
          description: obj.data.content.fields.description,
          image: obj.data.content.fields.image,
          tokenUri: obj.data.content.fields.token_uri,
        }))

      setAgents(agentList)
      if (agentList.length > 0 && !selectedAgent) {
        setSelectedAgent(agentList[0].id)
      }
    } catch (error) {
      console.error('Error loading agents:', error)
    }
  }

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgent || (!description && !image)) return

    setLoading(true)
    setResult('')

    try {
      const tx = new Transaction()

      // Update description if provided
      if (description) {
        tx.moveCall({
          target: `${MODULES.IDENTITY_REGISTRY}::set_description`,
          arguments: [
            tx.object(selectedAgent),
            tx.pure.string(description),
          ],
        })
      }

      // Update image if provided
      if (image) {
        tx.moveCall({
          target: `${MODULES.IDENTITY_REGISTRY}::set_image`,
          arguments: [
            tx.object(selectedAgent),
            tx.pure.string(image),
          ],
        })
      }

      signAndExecute(
        {
          transaction: tx as any,
        },
        {
          onSuccess: async (result) => {
            await suiClient.waitForTransaction({
              digest: result.digest,
            })
            setResult(`Success! Agent details updated. Transaction: ${result.digest}`)
            setDescription('')
            setImage('')
            setLoading(false)
          },
          onError: (error) => {
            console.error('Transaction failed:', error)
            setResult(`Error: ${error.message}`)
            setLoading(false)
          },
        }
      )
    } catch (error: any) {
      console.error('Error:', error)
      setResult(`Error: ${error.message}`)
      setLoading(false)
    }
  }

  const handleAddEndpoint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgent || !endpointName || !endpointUrl) return

    setLoading(true)
    setResult('')

    try {
      const tx = new Transaction()

      tx.moveCall({
        target: `${MODULES.IDENTITY_REGISTRY}::add_endpoint`,
        arguments: [
          tx.object(selectedAgent),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(endpointName))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(endpointUrl))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(endpointVersion))),
        ],
      })

      signAndExecute(
        {
          transaction: tx as any,
        },
        {
          onSuccess: async (result) => {
            await suiClient.waitForTransaction({
              digest: result.digest,
            })
            setResult(`Success! Endpoint added. Transaction: ${result.digest}`)
            setEndpointName('')
            setEndpointUrl('')
            setEndpointVersion('1.0.0')
            setLoading(false)
          },
          onError: (error) => {
            console.error('Transaction failed:', error)
            setResult(`Error: ${error.message}`)
            setLoading(false)
          },
        }
      )
    } catch (error: any) {
      console.error('Error:', error)
      setResult(`Error: ${error.message}`)
      setLoading(false)
    }
  }

  const handleSetTokenUri = async () => {
    if (!selectedAgent || !tokenUri) return

    setLoading(true)
    setResult('')

    try {
      const tx = new Transaction()

      tx.moveCall({
        target: `${MODULES.IDENTITY_REGISTRY}::set_token_uri`,
        arguments: [
          tx.object(selectedAgent),
          tx.pure.string(tokenUri),
        ],
      })

      signAndExecute(
        {
          transaction: tx as any,
        },
        {
          onSuccess: async (result) => {
            await suiClient.waitForTransaction({
              digest: result.digest,
            })
            setResult(`Success! Token URI updated. Transaction: ${result.digest}`)
            setTokenUri('')
            setLoading(false)
          },
          onError: (error) => {
            console.error('Transaction failed:', error)
            setResult(`Error: ${error.message}`)
            setLoading(false)
          },
        }
      )
    } catch (error: any) {
      console.error('Error:', error)
      setResult(`Error: ${error.message}`)
      setLoading(false)
    }
  }

  const handleStoreMetadataOnWalrus = async () => {
    if (!selectedAgent || !account || !metadataJson) return

    setLoading(true)
    setUploadingToWalrus(true)
    setResult('')

    try {
      // Parse and validate the metadata JSON
      let metadata: AgentMetadata
      try {
        metadata = JSON.parse(metadataJson)
      } catch (e) {
        throw new Error('Invalid JSON format. Please check your metadata.')
      }

      // Validate required fields
      if (!metadata.name || !metadata.description) {
        throw new Error('Metadata must include at least name and description fields')
      }

      // Ensure endpoints array exists
      if (!metadata.endpoints) {
        metadata.endpoints = []
      }

      setResult('Storing metadata on Walrus...')

      // Store on Walrus
      const { blobId, walrusUri } = await storeMetadataWithFlow(
        metadata,
        account.address,
        signAndExecute,
        suiClient,
        10
      )

      setUploadingToWalrus(false)
      setResult(`Metadata stored on Walrus (${blobId}). Updating token URI...`)

      // Update token URI with Walrus blob ID
      const tx = new Transaction()

      tx.moveCall({
        target: `${MODULES.IDENTITY_REGISTRY}::set_token_uri`,
        arguments: [
          tx.object(selectedAgent),
          tx.pure.string(walrusUri),
        ],
      })

      signAndExecute(
        {
          transaction: tx as any,
        },
        {
          onSuccess: async (result) => {
            await suiClient.waitForTransaction({
              digest: result.digest,
            })
            setResult(`Success! Metadata stored on Walrus and token URI updated. Transaction: ${result.digest}`)
            setMetadataJson('')
            setLoading(false)
            loadAgents() // Reload agents to get updated data
          },
          onError: (error) => {
            console.error('Transaction failed:', error)
            setResult(`Error: ${error.message}`)
            setLoading(false)
            setUploadingToWalrus(false)
          },
        }
      )
    } catch (error: any) {
      console.error('Error:', error)
      setResult(`Error: ${error.message}`)
      setLoading(false)
      setUploadingToWalrus(false)
    }
  }

  const generateTemplateMetadata = () => {
    const currentAgent = agents.find(a => a.id === selectedAgent)
    if (!currentAgent) return

    const template: AgentMetadata = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: currentAgent.name || "myAgentName",
      description: currentAgent.description || "A natural language description of the Agent",
      image: currentAgent.image || "https://example.com/agentimage.png",
      endpoints: [
        {
          name: "A2A",
          endpoint: "https://agent.example/.well-known/agent-card.json",
          version: "0.3.0"
        }
      ],
      registrations: [
        {
          agentId: parseInt(currentAgent.agentId) || 0,
          agentRegistry: `sui:testnet:${CONTRACT_CONFIG.PACKAGE_ID}`
        }
      ],
      supportedTrust: [
        "reputation",
        "crypto-economic"
      ]
    }

    setMetadataJson(JSON.stringify(template, null, 2))
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">You need to register an agent first before setting metadata.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-green-600 rounded-lg p-8 text-white">
        <div className="flex items-center mb-4">
          <div className="bg-green-700 p-3 rounded-lg mr-4">
            <FontAwesomeIcon icon={faDatabase} className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-1">Set Agent Metadata</h2>
            <p className="text-green-100">
              Update token URI or set custom metadata for your agents
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="mb-6">
          <label htmlFor="agent" className="block text-sm font-medium text-gray-700 mb-2">
            Select Agent
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FontAwesomeIcon icon={faRobot} className="h-5 w-5 text-gray-400" />
            </div>
            <select
              id="agent"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  Agent #{agent.agentId} - {agent.id.slice(0, 16)}...
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <FontAwesomeIcon icon={faChevronDown} className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Set Token URI */}
        <div className="border border-gray-200 rounded-lg p-6 mb-6 bg-blue-50">
          <div className="flex items-center mb-4">
            <div className="bg-blue-100 p-2 rounded-lg mr-3">
              <FontAwesomeIcon icon={faLink} className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Update Token URI</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="tokenUri" className="block text-sm font-medium text-gray-700 mb-2">
                New Token URI
              </label>
              <input
                type="text"
                id="tokenUri"
                value={tokenUri}
                onChange={(e) => setTokenUri(e.target.value)}
                placeholder="ipfs://QmYourAgentMetadata"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={handleSetTokenUri}
              disabled={loading || !tokenUri}
              className="w-full bg-secondary text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin h-5 w-5 mr-2" />
                  Updating...
                </>
              ) : (
                'Update Token URI'
              )}
            </button>
          </div>
        </div>

        {/* Update Agent Details */}
        <div className="border border-gray-200 rounded-lg p-6 mb-6 bg-purple-50">
          <div className="flex items-center mb-4">
            <div className="bg-purple-100 p-2 rounded-lg mr-3">
              <FontAwesomeIcon icon={faRobot} className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Update Agent Details (On-Chain Only)</h3>
          </div>
          <form onSubmit={handleUpdateDetails} className="space-y-4">
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your agent's capabilities"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-2">
                Image URL
              </label>
              <input
                type="text"
                id="image"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://example.com/agent-image.png"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading || (!description && !image)}
              className="w-full bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin h-5 w-5 mr-2" />
                  Updating...
                </>
              ) : (
                'Update Details (On-Chain)'
              )}
            </button>
          </form>
        </div>

        {/* Store 8004 Metadata on Walrus */}
        <div className="border border-blue-200 rounded-lg p-6 mb-6 bg-blue-50">
          <div className="flex items-center mb-4">
            <div className="bg-blue-100 p-2 rounded-lg mr-3">
              <FontAwesomeIcon icon={faCloudUploadAlt} className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">Store 8004 Metadata on Walrus</h3>
              <p className="text-sm text-blue-700 mt-1">Store structured JSON metadata on Walrus and update token URI</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="metadata-json" className="block text-sm font-medium text-gray-700">
                  Agent Metadata (8004 JSON)
                </label>
                <button
                  type="button"
                  onClick={generateTemplateMetadata}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                >
                  Generate Template
                </button>
              </div>
              <textarea
                id="metadata-json"
                value={metadataJson}
                onChange={(e) => setMetadataJson(e.target.value)}
                placeholder={'{\n  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",\n  "name": "myAgentName",\n  "description": "Agent description",\n  "image": "https://example.com/image.png",\n  "endpoints": [...],\n  "registrations": [...],\n  "supportedTrust": [...]\n}'}
                rows={12}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none font-mono text-sm"
              />
            </div>

            <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 text-sm text-blue-800">
              <div className="flex items-start">
                <FontAwesomeIcon icon={faInfoCircle} className="mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold mb-1">8004 Compliant Metadata</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Supports endpoints (A2A, MCP, OASF, ENS, DID, etc.)</li>
                    <li>Includes registrations and trust mechanisms</li>
                    <li>Stored permanently on Walrus (10 epochs on testnet)</li>
                    <li>Token URI automatically updated to walrus://blobId</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStoreMetadataOnWalrus}
              disabled={loading || !metadataJson}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading && uploadingToWalrus ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin h-5 w-5 mr-2" />
                  Storing on Walrus...
                </>
              ) : loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin h-5 w-5 mr-2" />
                  Updating...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCloudUploadAlt} className="h-5 w-5 mr-2" />
                  Store Metadata on Walrus
                </>
              )}
            </button>
          </div>
        </div>

        {/* Add Endpoint */}
        <div className="border border-gray-200 rounded-lg p-6 bg-green-50">
          <div className="flex items-center mb-4">
            <div className="bg-green-100 p-2 rounded-lg mr-3">
              <FontAwesomeIcon icon={faTag} className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Add Endpoint</h3>
          </div>
          <form onSubmit={handleAddEndpoint} className="space-y-4">
            <div>
              <label htmlFor="endpointName" className="block text-sm font-medium text-gray-700 mb-2">
                Endpoint Name
              </label>
              <input
                type="text"
                id="endpointName"
                value={endpointName}
                onChange={(e) => setEndpointName(e.target.value)}
                placeholder="API"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="endpointUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Endpoint URL
              </label>
              <input
                type="text"
                id="endpointUrl"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://api.example.com/agent"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="endpointVersion" className="block text-sm font-medium text-gray-700 mb-2">
                Version
              </label>
              <input
                type="text"
                id="endpointVersion"
                value={endpointVersion}
                onChange={(e) => setEndpointVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !endpointName || !endpointUrl}
              className="w-full bg-secondary text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin h-5 w-5 mr-2" />
                  Adding...
                </>
              ) : (
                'Add Endpoint'
              )}
            </button>
          </form>
        </div>
      </div>

      {result && (
        <div className={`p-4 rounded-lg animate-in fade-in duration-300 ${result.includes('Error') ? 'bg-red-50 text-red-800 border-2 border-red-200' : 'bg-green-50 text-green-800 border-2 border-green-200'}`}>
          <div className="flex items-start">
            {result.includes('Error') ? (
              <FontAwesomeIcon icon={faTimesCircle} className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            ) : (
              <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm break-all flex-1">{result}</p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
          <FontAwesomeIcon icon={faInfoCircle} className="w-5 h-5 mr-2" />
          Agent Management Tips
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Update on-chain details or use Walrus storage</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Walrus stores metadata permanently & decentralized</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Token URI can be manually set or auto-updated via Walrus</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Add endpoints for agent API access</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Only the agent owner can modify details</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Walrus storage: 3 epochs on testnet</span>
          </div>
        </div>
      </div>
    </div>
  )
}
