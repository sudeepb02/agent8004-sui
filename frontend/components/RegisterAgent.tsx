'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRocket, faSpinner, faLink, faCloudUploadAlt, faInfoCircle, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons'
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG, MODULES } from '@/config/contracts'
import { storeMetadataWithFlow, type AgentMetadata } from '@/utils/walrus'

export default function RegisterAgent() {
  const [metadataJson, setMetadataJson] = useState('')
  const [useSimpleMode, setUseSimpleMode] = useState(true)
  const [name, setName] = useState('MyAIAgent')
  const [description, setDescription] = useState('An AI agent that helps with task automation and decision making')
  const [image, setImage] = useState('https://example.com/agent-avatar.png')
  const [loading, setLoading] = useState(false)
  const [uploadingToWalrus, setUploadingToWalrus] = useState(false)
  const [result, setResult] = useState<string>('')
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const suiClient = useSuiClient()
  const currentAccount = useCurrentAccount()

  // Initialize metadata JSON with template
  useEffect(() => {
    if (!metadataJson) {
      generateTemplateMetadata()
    }
  }, [])

  const generateTemplateMetadata = () => {
    const template: AgentMetadata = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: name || "MyAIAgent",
      description: description || "An AI agent that helps with task automation and decision making",
      image: image || "https://example.com/agent-avatar.png",
      endpoints: [
        {
          name: "A2A",
          endpoint: "https://agent.example/.well-known/agent-card.json",
          version: "0.3.0"
        },
        {
          name: "MCP",
          endpoint: "https://mcp.agent.example/",
          version: "2025-06-18"
        }
      ],
      registrations: [
        {
          agentId: 0,
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

  const syncSimpleModeToJson = () => {
    try {
      const metadata = JSON.parse(metadataJson)
      metadata.name = name
      metadata.description = description
      metadata.image = image
      setMetadataJson(JSON.stringify(metadata, null, 2))
    } catch (e) {
      // If JSON is invalid, regenerate template
      generateTemplateMetadata()
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult('')

    try {
      if (!currentAccount?.address) {
        setResult('Error: No wallet connected')
        setLoading(false)
        return
      }

      // Parse and validate metadata
      let metadata: AgentMetadata
      try {
        if (useSimpleMode) {
          syncSimpleModeToJson()
        }
        metadata = JSON.parse(metadataJson)
      } catch (e) {
        setResult('Error: Invalid JSON format. Please check your metadata.')
        setLoading(false)
        return
      }

      // Validate required fields
      if (!metadata.name || !metadata.description) {
        setResult('Error: Metadata must include at least name and description fields')
        setLoading(false)
        return
      }

      // Ensure endpoints array exists
      if (!metadata.endpoints) {
        metadata.endpoints = []
      }

      // Store metadata on Walrus
      setUploadingToWalrus(true)
      setResult('Storing 8004 metadata on Walrus...')

      const { blobId, walrusUri } = await storeMetadataWithFlow(
        metadata,
        currentAccount.address,
        signAndExecute,
        suiClient,
        10 // Store for 10 epochs
      )

      setUploadingToWalrus(false)
      setResult(`Metadata stored on Walrus (${blobId}). Now registering agent...`)

      // Use the Walrus URI as the token URI
      const finalTokenUri = walrusUri
      
      // Extract basic info from metadata for on-chain storage
      const onChainName = metadata.name
      const onChainDescription = metadata.description
      const onChainImage = metadata.image || ""

      const tx = new Transaction()

      // Call the register function with metadata from JSON
      let agent = tx.moveCall({
        target: `${MODULES.IDENTITY_REGISTRY}::register`,
        arguments: [
          tx.object(CONTRACT_CONFIG.IDENTITY_REGISTRY_ID),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(onChainName))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(onChainDescription))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(onChainImage))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(finalTokenUri))),
        ],
      })

      // Transfer the agent object to the sender
      tx.transferObjects([agent], tx.pure.address(currentAccount.address))
    
      signAndExecute(
        {
          transaction: tx as any,
        },
        {
          onSuccess: async (result) => {
            await suiClient.waitForTransaction({
              digest: result.digest,
            })
            setResult(`Success! Agent registered with 8004 metadata on Walrus. Transaction: ${result.digest}`)
            // Clear form
            setName('MyAIAgent')
            setDescription('An AI agent that helps with task automation and decision making')
            setImage('https://example.com/agent-avatar.png')
            generateTemplateMetadata()
            setLoading(false)
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

  return (
    <div className="space-y-6">
      <div className="bg-blue-600 rounded-lg p-8 text-white">
        <div className="flex items-center mb-4">
          <div className="bg-blue-700 p-3 rounded-lg mr-4">
            <FontAwesomeIcon icon={faRocket} className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-1">Register New Agent</h2>
            <p className="text-blue-100">
              Create a unique agent identity on the Sui blockchain
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Mode Toggle */}
        <div className="mb-6 flex items-center justify-between bg-gray-50 rounded-lg p-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Metadata Input Mode</h3>
            <p className="text-xs text-gray-600">
              {useSimpleMode 
                ? 'Simple mode: Fill basic fields (JSON preview below)' 
                : 'Advanced mode: Edit full 8004 compliant JSON metadata'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (useSimpleMode) {
                syncSimpleModeToJson()
              }
              setUseSimpleMode(!useSimpleMode)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            {useSimpleMode ? 'Switch to Advanced' : 'Switch to Simple'}
          </button>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          {useSimpleMode ? (
            // Simple Mode
            <>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Agent Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    const metadata = JSON.parse(metadataJson)
                    metadata.name = e.target.value
                    setMetadataJson(JSON.stringify(metadata, null, 2))
                  }}
                  placeholder="MyAIAgent"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    try {
                      const metadata = JSON.parse(metadataJson)
                      metadata.description = e.target.value
                      setMetadataJson(JSON.stringify(metadata, null, 2))
                    } catch (e) {}
                  }}
                  placeholder="An AI agent that helps with task automation and decision making"
                  required
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-2">
                  Image URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="image"
                  value={image}
                  onChange={(e) => {
                    setImage(e.target.value)
                    try {
                      const metadata = JSON.parse(metadataJson)
                      metadata.image = e.target.value
                      setMetadataJson(JSON.stringify(metadata, null, 2))
                    } catch (e) {}
                  }}
                  placeholder="https://example.com/agent-avatar.png or ipfs://..."
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="mt-2 text-sm text-gray-500">
                  URL to your agent's profile image
                </p>
              </div>

              {/* JSON Preview in Simple Mode */}
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-blue-900">
                    <FontAwesomeIcon icon={faInfoCircle} className="mr-2" />
                    8004 Metadata Preview
                  </label>
                  <button
                    type="button"
                    onClick={generateTemplateMetadata}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                  >
                    Reset Template
                  </button>
                </div>
                <textarea
                  value={metadataJson}
                  readOnly
                  rows={8}
                  className="w-full px-3 py-2 border border-blue-300 rounded bg-white font-mono text-xs"
                />
              </div>
            </>
          ) : (
            // Advanced Mode - Full JSON Editor
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="metadata-json" className="block text-sm font-medium text-gray-700">
                  8004 Agent Metadata (JSON) <span className="text-red-500">*</span>
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
                placeholder="Enter 8004 compliant JSON metadata or click 'Generate Template'"
                required
                rows={18}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none font-mono text-sm"
              />
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                <FontAwesomeIcon icon={faInfoCircle} className="mr-2" />
                <span className="font-semibold">8004 Standard:</span> Include type, name, description, image, endpoints, registrations, and supportedTrust fields
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !metadataJson}
            className="w-full bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
          >
            {loading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="animate-spin h-5 w-5 mr-2" />
                {uploadingToWalrus ? 'Storing 8004 Metadata on Walrus...' : 'Registering Agent...'}
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faRocket} className="h-5 w-5 mr-2" />
                Register Agent with 8004 Metadata
              </>
            )}
          </button>
        </form>
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
          <FontAwesomeIcon icon={faCloudUploadAlt} className="w-5 h-5 mr-2" />
          8004 Registration with Walrus Storage
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Full 8004 compliant metadata structure</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Supports multiple endpoint types (A2A, MCP, OASF, etc.)</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Metadata stored permanently on Walrus (10 epochs)</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Token URI automatically set to walrus://blobId</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Simple mode for quick setup, advanced for full control</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Registrations and trust mechanisms included</span>
          </div>
        </div>
      </div>
    </div>
  )
}
