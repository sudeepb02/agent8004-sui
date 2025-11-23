'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faRocket,
  faSpinner,
  faLink,
  faCloudUploadAlt,
  faInfoCircle,
  faCheckCircle,
  faTimesCircle,
} from '@fortawesome/free-solid-svg-icons'
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG, MODULES } from '@/config/contracts'
import {
  storeMetadataWithFlow,
  uploadImageToWalrus,
  uploadImageFromUrlToWalrus,
  type AgentMetadata,
} from '@/utils/walrus'

export default function RegisterAgent() {
  const [metadataJson, setMetadataJson] = useState('')
  const [useSimpleMode, setUseSimpleMode] = useState(true)
  const [name, setName] = useState('MyAIAgent')
  const [description, setDescription] = useState(
    'An AI agent that helps with task automation and decision making'
  )
  const [image, setImage] = useState('https://example.com/agent-avatar.png')
  const [imageUploadMode, setImageUploadMode] = useState<'url' | 'file'>('url')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('https://example.com/agent-avatar.png')
  const [uploadingImage, setUploadingImage] = useState(false)
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

  const handleImageUpload = async () => {
    if (!currentAccount?.address) {
      setResult('Error: No wallet connected')
      return
    }

    try {
      setUploadingImage(true)
      setResult('Uploading image to Walrus...')

      let walrusImageUri: string

      if (imageUploadMode === 'file' && imageFile) {
        // Upload file directly
        const { blobId } = await uploadImageToWalrus(
          imageFile,
          currentAccount.address,
          signAndExecute,
          suiClient
        )
        walrusImageUri = `walrus://${blobId}`
      } else if (imageUploadMode === 'url' && imageUrl) {
        // Upload from URL
        const { blobId } = await uploadImageFromUrlToWalrus(
          imageUrl,
          currentAccount.address,
          signAndExecute,
          suiClient
        )
        walrusImageUri = `walrus://${blobId}`
      } else {
        throw new Error('Please provide an image file or URL')
      }

      // Update the image field with Walrus URI
      setImage(walrusImageUri)
      try {
        const metadata = JSON.parse(metadataJson)
        metadata.image = walrusImageUri
        setMetadataJson(JSON.stringify(metadata, null, 2))
      } catch (e) {
        // If JSON is invalid, regenerate
        generateTemplateMetadata()
      }

      setResult(`Image uploaded to Walrus successfully! URI: ${walrusImageUri}`)
      setUploadingImage(false)
    } catch (error: any) {
      console.error('Error uploading image:', error)
      setResult(`Error uploading image: ${error.message}`)
      setUploadingImage(false)
    }
  }

  const generateTemplateMetadata = () => {
    const template: AgentMetadata = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: name || 'MyAIAgent',
      description: description || 'An AI agent that helps with task automation and decision making',
      image: image || 'https://example.com/agent-avatar.png',
      endpoints: [
        {
          name: 'A2A',
          endpoint: 'https://agent.example/.well-known/agent-card.json',
          version: '0.3.0',
        },
        {
          name: 'MCP',
          endpoint: 'https://mcp.agent.example/',
          version: '2025-06-18',
        },
      ],
      registrations: [
        {
          agentId: 0,
          agentRegistry: `sui:testnet:${CONTRACT_CONFIG.PACKAGE_ID}`,
        },
      ],
      supportedTrust: ['reputation', 'crypto-economic'],
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
      const onChainImage = metadata.image || ''

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
            setResult(
              `Success! Agent registered with 8004 metadata on Walrus. View transaction: https://suiscan.xyz/testnet/tx/${result.digest}`
            )
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
      <div className="rounded-lg bg-blue-600 p-8 text-white">
        <div className="mb-4 flex items-center">
          <div className="mr-4 rounded-lg bg-blue-700 p-3">
            <FontAwesomeIcon icon={faRocket} className="h-8 w-8" />
          </div>
          <div>
            <h2 className="mb-1 text-3xl font-bold">Register New Agent</h2>
            <p className="text-blue-100">Create a unique agent identity on the Sui blockchain</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-8 shadow-lg">
        {/* Mode Toggle */}
        <div className="mb-6 flex items-center justify-between rounded-lg bg-gray-50 p-4">
          <div className="flex-1">
            <h3 className="mb-1 text-sm font-semibold text-gray-900">Metadata Input Mode</h3>
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
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {useSimpleMode ? 'Switch to Advanced' : 'Switch to Simple'}
          </button>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          {useSimpleMode ? (
            // Simple Mode
            <>
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium text-gray-700">
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
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
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
                  className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Agent Image <span className="text-red-500">*</span>
                </label>

                {/* Image Upload Mode Toggle */}
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setImageUploadMode('url')}
                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      imageUploadMode === 'url'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <FontAwesomeIcon icon={faLink} className="mr-2" />
                    Image URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUploadMode('file')}
                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      imageUploadMode === 'file'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <FontAwesomeIcon icon={faCloudUploadAlt} className="mr-2" />
                    Upload File
                  </button>
                </div>

                {/* Image URL Input */}
                {imageUploadMode === 'url' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/agent-avatar.png"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={handleImageUpload}
                      disabled={!imageUrl || uploadingImage || !currentAccount}
                      className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                          Uploading to Walrus...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faCloudUploadAlt} className="mr-2" />
                          Upload from URL to Walrus
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* File Upload Input */}
                {imageUploadMode === 'file' && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setImageFile(file)
                        }
                      }}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-primary"
                    />
                    {imageFile && (
                      <p className="text-sm text-gray-600">
                        Selected: {imageFile.name} ({(imageFile.size / 1024).toFixed(2)} KB)
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleImageUpload}
                      disabled={!imageFile || uploadingImage || !currentAccount}
                      className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                          Uploading to Walrus...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faCloudUploadAlt} className="mr-2" />
                          Upload File to Walrus
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Current Image Display */}
                {image && (
                  <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-sm font-medium text-green-900">
                      <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
                      Current Image URI:
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-green-700">{image}</p>
                  </div>
                )}

                <p className="mt-2 text-sm text-gray-500">
                  Upload an image file or provide a URL. The image will be stored on Walrus.
                </p>
              </div>

              {/* JSON Preview in Simple Mode */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-blue-900">
                    <FontAwesomeIcon icon={faInfoCircle} className="mr-2" />
                    8004 Metadata Preview
                  </label>
                  <button
                    type="button"
                    onClick={generateTemplateMetadata}
                    className="rounded bg-blue-600 px-3 py-1 text-xs text-white transition-colors hover:bg-blue-700"
                  >
                    Reset Template
                  </button>
                </div>
                <textarea
                  value={metadataJson}
                  readOnly
                  rows={8}
                  className="w-full rounded border border-blue-300 bg-white px-3 py-2 font-mono text-xs"
                />
              </div>
            </>
          ) : (
            // Advanced Mode - Full JSON Editor
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="metadata-json" className="block text-sm font-medium text-gray-700">
                  8004 Agent Metadata (JSON) <span className="text-red-500">*</span>
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
                placeholder="Enter 8004 compliant JSON metadata or click 'Generate Template'"
                required
                rows={18}
                className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
              />
              <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <FontAwesomeIcon icon={faInfoCircle} className="mr-2" />
                <span className="font-semibold">8004 Standard:</span> Include type, name,
                description, image, endpoints, registrations, and supportedTrust fields
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !metadataJson}
            className="flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="mr-2 h-5 w-5 animate-spin" />
                {uploadingToWalrus ? 'Storing 8004 Metadata on Walrus...' : 'Registering Agent...'}
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faRocket} className="mr-2 h-5 w-5" />
                Register Agent with 8004 Metadata
              </>
            )}
          </button>
        </form>
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
          <FontAwesomeIcon icon={faCloudUploadAlt} className="mr-2 h-5 w-5" />
          8004 Registration with Walrus Storage
        </h3>
        <div className="grid gap-4 text-sm text-blue-800 md:grid-cols-2">
          <div className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Full 8004 compliant metadata structure</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Supports multiple endpoint types (A2A, MCP, OASF, etc.)</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Metadata stored permanently on Walrus (10 epochs)</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Token URI automatically set to walrus://blobId</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Simple mode for quick setup, advanced for full control</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Registrations and trust mechanisms included</span>
          </div>
        </div>
      </div>
    </div>
  )
}
