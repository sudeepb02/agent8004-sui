'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faDatabase,
  faSpinner,
  faRobot,
  faLink,
  faKey,
  faInfoCircle,
  faTag,
  faCloudUploadAlt,
  faChevronDown,
  faCheckCircle,
  faTimesCircle,
} from '@fortawesome/free-solid-svg-icons'
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG, MODULES } from '@/config/contracts'
import {
  storeMetadataWithFlow,
  type AgentMetadata,
  type Endpoint,
  readMetadataFromWalrus,
} from '@/utils/walrus'
import { loadAgentsByOwner } from '@/utils/agentUtils'

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
      const agentList = await loadAgentsByOwner(suiClient, account.address)
      // Map to simpler Agent type used in this component
      const simplifiedAgents = agentList.map((agent) => ({
        id: agent.id,
        agentId: agent.agentId,
        name: agent.name,
        description: agent.description,
        image: agent.image,
        tokenUri: agent.tokenUri,
      }))
      setAgents(simplifiedAgents)
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
          arguments: [tx.object(selectedAgent), tx.pure.string(description)],
        })
      }

      // Update image if provided
      if (image) {
        tx.moveCall({
          target: `${MODULES.IDENTITY_REGISTRY}::set_image`,
          arguments: [tx.object(selectedAgent), tx.pure.string(image)],
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
            setResult(
              `Success! Agent details updated. View transaction: https://suiscan.xyz/testnet/tx/${result.digest}`
            )
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
            setResult(
              `Success! Endpoint added. View transaction: https://suiscan.xyz/testnet/tx/${result.digest}`
            )
            setEndpointName('')
            setEndpointUrl('')
            setEndpointVersion('')
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
        arguments: [tx.object(selectedAgent), tx.pure.string(tokenUri)],
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
            setResult(
              `Success! Token URI updated. View transaction: https://suiscan.xyz/testnet/tx/${result.digest}`
            )
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
        arguments: [tx.object(selectedAgent), tx.pure.string(walrusUri)],
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
            setResult(
              `Success! Metadata stored on Walrus and token URI updated. Transaction: ${result.digest}`
            )
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
    const currentAgent = agents.find((a) => a.id === selectedAgent)
    if (!currentAgent) return

    const template: AgentMetadata = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: currentAgent.name || 'myAgentName',
      description: currentAgent.description || 'A natural language description of the Agent',
      image: currentAgent.image || 'https://example.com/agentimage.png',
      endpoints: [
        {
          name: 'A2A',
          endpoint: 'https://agent.example/.well-known/agent-card.json',
          version: '0.3.0',
        },
      ],
      registrations: [
        {
          agentId: parseInt(currentAgent.agentId) || 0,
          agentRegistry: `sui:testnet:${CONTRACT_CONFIG.PACKAGE_ID}`,
        },
      ],
      supportedTrust: ['reputation', 'crypto-economic'],
    }

    setMetadataJson(JSON.stringify(template, null, 2))
  }

  if (agents.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-gray-600">
          You need to register an agent first before setting metadata.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-green-600 p-8 text-white">
        <div className="mb-4 flex items-center">
          <div className="mr-4 rounded-lg bg-green-700 p-3">
            <FontAwesomeIcon icon={faDatabase} className="h-8 w-8" />
          </div>
          <div>
            <h2 className="mb-1 text-3xl font-bold">Set Agent Metadata</h2>
            <p className="text-green-100">
              Update token URI or set custom metadata for your agents
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6">
          <label htmlFor="agent" className="mb-2 block text-sm font-medium text-gray-700">
            Select Agent
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <FontAwesomeIcon icon={faRobot} className="h-5 w-5 text-gray-400" />
            </div>
            <select
              id="agent"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-primary"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  Agent #{agent.agentId} - {agent.id.slice(0, 16)}...
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <FontAwesomeIcon icon={faChevronDown} className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Set Token URI */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-blue-50 p-6">
          <div className="mb-4 flex items-center">
            <div className="mr-3 rounded-lg bg-blue-100 p-2">
              <FontAwesomeIcon icon={faLink} className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Update Token URI</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="tokenUri" className="mb-2 block text-sm font-medium text-gray-700">
                New Token URI
              </label>
              <input
                type="text"
                id="tokenUri"
                value={tokenUri}
                onChange={(e) => setTokenUri(e.target.value)}
                placeholder="ipfs://QmYourAgentMetadata"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="button"
              onClick={handleSetTokenUri}
              disabled={loading || !tokenUri}
              className="flex w-full items-center justify-center rounded-lg bg-secondary px-6 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="mr-2 h-5 w-5 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Token URI'
              )}
            </button>
          </div>
        </div>

        {/* Update Agent Details */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-purple-50 p-6">
          <div className="mb-4 flex items-center">
            <div className="mr-3 rounded-lg bg-purple-100 p-2">
              <FontAwesomeIcon icon={faRobot} className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Update Agent Details (On-Chain Only)
            </h3>
          </div>
          <form onSubmit={handleUpdateDetails} className="space-y-4">
            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your agent's capabilities"
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="image" className="mb-2 block text-sm font-medium text-gray-700">
                Image URL
              </label>
              <input
                type="text"
                id="image"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://example.com/agent-image.png"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading || (!description && !image)}
              className="flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="mr-2 h-5 w-5 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Details (On-Chain)'
              )}
            </button>
          </form>
        </div>

        {/* Store 8004 Metadata on Walrus */}
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <div className="mb-4 flex items-center">
            <div className="mr-3 rounded-lg bg-blue-100 p-2">
              <FontAwesomeIcon icon={faCloudUploadAlt} className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">Store 8004 Metadata on Walrus</h3>
              <p className="mt-1 text-sm text-blue-700">
                Store structured JSON metadata on Walrus and update token URI
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="metadata-json" className="block text-sm font-medium text-gray-700">
                  Agent Metadata (8004 JSON)
                </label>
                <button
                  type="button"
                  onClick={generateTemplateMetadata}
                  className="rounded bg-blue-600 px-3 py-1 text-xs text-white transition-colors hover:bg-blue-700"
                >
                  Generate Template
                </button>
              </div>
              <textarea
                id="metadata-json"
                value={metadataJson}
                onChange={(e) => setMetadataJson(e.target.value)}
                placeholder={
                  '{\n  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",\n  "name": "myAgentName",\n  "description": "Agent description",\n  "image": "https://example.com/image.png",\n  "endpoints": [...],\n  "registrations": [...],\n  "supportedTrust": [...]\n}'
                }
                rows={12}
                className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="rounded-lg border border-blue-300 bg-blue-100 p-3 text-sm text-blue-800">
              <div className="flex items-start">
                <FontAwesomeIcon icon={faInfoCircle} className="mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="mb-1 font-semibold">8004 Compliant Metadata</p>
                  <ul className="list-inside list-disc space-y-1 text-xs">
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
              className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && uploadingToWalrus ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="mr-2 h-5 w-5 animate-spin" />
                  Storing on Walrus...
                </>
              ) : loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="mr-2 h-5 w-5 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCloudUploadAlt} className="mr-2 h-5 w-5" />
                  Store Metadata on Walrus
                </>
              )}
            </button>
          </div>
        </div>

        {/* Add Endpoint */}
        <div className="rounded-lg border border-gray-200 bg-green-50 p-6">
          <div className="mb-4 flex items-center">
            <div className="mr-3 rounded-lg bg-green-100 p-2">
              <FontAwesomeIcon icon={faTag} className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Add Endpoint</h3>
          </div>
          <form onSubmit={handleAddEndpoint} className="space-y-4">
            <div>
              <label
                htmlFor="endpointName"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Endpoint Name
              </label>
              <input
                type="text"
                id="endpointName"
                value={endpointName}
                onChange={(e) => setEndpointName(e.target.value)}
                placeholder="API"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="endpointUrl" className="mb-2 block text-sm font-medium text-gray-700">
                Endpoint URL
              </label>
              <input
                type="text"
                id="endpointUrl"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://api.example.com/agent"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="endpointVersion"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Version
              </label>
              <input
                type="text"
                id="endpointVersion"
                value={endpointVersion}
                onChange={(e) => setEndpointVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !endpointName || !endpointUrl}
              className="flex w-full items-center justify-center rounded-lg bg-secondary px-6 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="mr-2 h-5 w-5 animate-spin" />
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
        <div
          className={`animate-in fade-in rounded-lg border-2 p-4 duration-300 ${result.includes('Error') ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}
        >
          <div className="flex items-start">
            {result.includes('Error') ? (
              <FontAwesomeIcon icon={faTimesCircle} className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0" />
            ) : (
              <FontAwesomeIcon icon={faCheckCircle} className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0" />
            )}
            <div className="flex-1 text-sm">
              {result.includes('https://') ? (
                <>
                  {result.split('https://')[0]}
                  <a
                    href={`https://${result.split('https://')[1]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline hover:text-green-900"
                  >
                    View on Suiscan →
                  </a>
                </>
              ) : (
                <p className="break-all">{result}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="mb-3 flex items-center font-semibold text-blue-900">
          <FontAwesomeIcon icon={faInfoCircle} className="mr-2 h-5 w-5" />
          Agent Management Tips
        </h3>
        <div className="grid gap-4 text-sm text-blue-800 md:grid-cols-2">
          <div className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Update on-chain details or use Walrus storage</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Walrus stores metadata permanently & decentralized</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Token URI can be manually set or auto-updated via Walrus</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Add endpoints for agent API access</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Only the agent owner can modify details</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Walrus storage: 3 epochs on testnet</span>
          </div>
        </div>
      </div>
    </div>
  )
}
