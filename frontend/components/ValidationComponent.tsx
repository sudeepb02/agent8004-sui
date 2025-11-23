'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faSpinner, faUpload, faFileAlt } from '@fortawesome/free-solid-svg-icons'
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { bcs } from '@mysten/sui/bcs'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG, MODULES, STRUCT_TYPES } from '@/config/contracts'
import { storeMetadataWithFlow } from '@/utils/walrus'
import type { Agent } from '@/types'

interface ValidationComponentProps {
  onBack: () => void
}

export default function ValidationComponent({ onBack }: ValidationComponentProps) {
  const account = useCurrentAccount()
  const [activeTab, setActiveTab] = useState<'request' | 'respond'>('request')
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [validatorAddress, setValidatorAddress] = useState('')
  const [requestInputType, setRequestInputType] = useState<'text' | 'file'>('text')
  const [requestText, setRequestText] = useState('')
  const [requestFile, setRequestFile] = useState<File | null>(null)
  const [requestUri, setRequestUri] = useState('')
  const [requestHash, setRequestHash] = useState('')
  const [uploadingToWalrus, setUploadingToWalrus] = useState(false)
  const [responseHash, setResponseHash] = useState('')
  const [response, setResponse] = useState(1)
  const [responseUri, setResponseUri] = useState('')
  const [responseTag, setResponseTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const suiClient = useSuiClient()

  useEffect(() => {
    if (account) {
      loadAgents()
      // Autofill validator address with connected wallet address
      setValidatorAddress(account.address)
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
            name: fields.name || '',
            description: fields.description || '',
            image: fields.image || '',
            tokenUri: fields.token_uri || '',
            endpoints: [],
            owner: fields.owner,
          }
        })

      setAgents(agentList)
      if (agentList.length > 0 && !selectedAgent) {
        setSelectedAgent(agentList[0].id)
      }
    } catch (error) {
      console.error('Error loading agents:', error)
    }
  }

  const handleValidationRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgent || !account) return

    setLoading(true)
    setResult('')

    try {
      let finalRequestUri = requestUri
      let finalRequestHash = requestHash

      // If using text or file input, upload to Walrus and generate hash
      if (requestInputType === 'text' && requestText.trim()) {
        setUploadingToWalrus(true)
        setResult('Uploading request data to Walrus...')

        const requestData = {
          type: 'validation-request',
          agentId: agents.find((a) => a.id === selectedAgent)?.agentId,
          content: requestText,
          timestamp: new Date().toISOString(),
          requester: account.address,
        }

        const { blobId, walrusUri } = await storeMetadataWithFlow(
          requestData as any,
          account.address,
          signAndExecute,
          suiClient,
          10
        )

        finalRequestUri = walrusUri

        // Generate hash from request data
        const dataBytes = new TextEncoder().encode(JSON.stringify(requestData))
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        finalRequestHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

        setUploadingToWalrus(false)
        setResult('Request data uploaded. Submitting on-chain...')
      } else if (requestInputType === 'file' && requestFile) {
        setUploadingToWalrus(true)
        setResult('Uploading file to Walrus...')

        const fileContent = await requestFile.text()
        const requestData = {
          type: 'validation-request',
          agentId: agents.find((a) => a.id === selectedAgent)?.agentId,
          fileName: requestFile.name,
          fileType: requestFile.type,
          content: fileContent,
          timestamp: new Date().toISOString(),
          requester: account.address,
        }

        const { blobId, walrusUri } = await storeMetadataWithFlow(
          requestData as any,
          account.address,
          signAndExecute,
          suiClient,
          10
        )

        finalRequestUri = walrusUri

        // Generate hash from file content
        const dataBytes = new TextEncoder().encode(JSON.stringify(requestData))
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        finalRequestHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

        setUploadingToWalrus(false)
        setResult('File uploaded. Submitting on-chain...')
      }

      const tx = new Transaction()

      tx.moveCall({
        target: `${MODULES.VALIDATION_REGISTRY}::validation_request`,
        arguments: [
          tx.object(CONTRACT_CONFIG.VALIDATION_REGISTRY_ID),
          tx.object(selectedAgent),
          tx.pure.address(validatorAddress),
          tx.pure(bcs.vector(bcs.u8()).serialize(new TextEncoder().encode(finalRequestUri))),
          tx.pure(bcs.vector(bcs.u8()).serialize(new TextEncoder().encode(finalRequestHash))),
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
            setResult(`Success! Validation request sent. Transaction: ${result.digest}`)
            setRequestText('')
            setRequestFile(null)
            setRequestUri('')
            setRequestHash('')
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
      setUploadingToWalrus(false)
    }
  }

  const handleValidationResponse = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setResult('')

    try {
      const tx = new Transaction()

      const requestHashBytes = new Uint8Array(new TextEncoder().encode(responseHash))
      const responseUriBytes = new Uint8Array(new TextEncoder().encode(responseUri))
      const responseHashBytes = new Uint8Array(new TextEncoder().encode(requestHash))
      const tagBytes = new Uint8Array(new TextEncoder().encode(responseTag))

      tx.moveCall({
        target: `${MODULES.VALIDATION_REGISTRY}::validation_response`,
        arguments: [
          tx.object(CONTRACT_CONFIG.VALIDATION_REGISTRY_ID),
          tx.pure(requestHashBytes),
          tx.pure.u8(response),
          tx.pure(responseUriBytes),
          tx.pure(responseHashBytes),
          tx.pure(tagBytes),
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
            setResult(`Success! Validation response submitted. Transaction: ${result.digest}`)
            setResponseHash('')
            setResponseUri('')
            setResponseTag('')
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

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center text-gray-600 transition-colors hover:text-gray-900"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="mr-2 h-5 w-5" />
        Back
      </button>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Validation Forms (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-xl bg-white shadow-lg">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  onClick={() => setActiveTab('request')}
                  className={`border-b-2 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === 'request'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Request Validation
                </button>
                <button
                  onClick={() => setActiveTab('respond')}
                  className={`border-b-2 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === 'respond'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Respond to Request
                </button>
              </nav>
            </div>

            <div className="p-8">
              {activeTab === 'request' ? (
                agents.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="mb-4 text-gray-600">You need to register an agent first.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h2 className="mb-2 text-2xl font-bold text-gray-900">Request Validation</h2>
                      <p className="text-gray-600">
                        Request a validator to verify your agent's interactions
                      </p>
                    </div>

                    <form onSubmit={handleValidationRequest} className="space-y-6">
                      <div>
                        <label
                          htmlFor="agent"
                          className="mb-2 block text-sm font-medium text-gray-700"
                        >
                          Select Agent
                        </label>
                        <select
                          id="agent"
                          value={selectedAgent}
                          onChange={(e) => setSelectedAgent(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                        >
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name || `Agent ${agent.agentId}`} (ID: {agent.agentId})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="validator"
                          className="mb-2 block text-sm font-medium text-gray-700"
                        >
                          Validator Address
                        </label>
                        <input
                          type="text"
                          id="validator"
                          value={validatorAddress}
                          onChange={(e) => setValidatorAddress(e.target.value)}
                          placeholder="0x..."
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                          required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Auto-filled with your connected wallet address
                        </p>
                      </div>

                      {/* Request Input Type Toggle */}
                      <div>
                        <label className="mb-3 block text-sm font-medium text-gray-700">
                          Request Data Input Method
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={() => setRequestInputType('text')}
                            className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 transition-all ${
                              requestInputType === 'text'
                                ? 'border-primary bg-blue-50 font-semibold text-primary'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <FontAwesomeIcon icon={faFileAlt} className="h-4 w-4" />
                            Text Input
                          </button>
                          <button
                            type="button"
                            onClick={() => setRequestInputType('file')}
                            className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 transition-all ${
                              requestInputType === 'file'
                                ? 'border-primary bg-blue-50 font-semibold text-primary'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <FontAwesomeIcon icon={faUpload} className="h-4 w-4" />
                            File Upload
                          </button>
                        </div>
                      </div>

                      {/* Text Input */}
                      {requestInputType === 'text' && (
                        <div>
                          <label
                            htmlFor="requestText"
                            className="mb-2 block text-sm font-medium text-gray-700"
                          >
                            Request Data <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            id="requestText"
                            value={requestText}
                            onChange={(e) => setRequestText(e.target.value)}
                            placeholder="Enter validation request details... This will be uploaded to Walrus and the hash will be automatically generated."
                            rows={6}
                            required
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                          />
                          <p className="mt-2 text-xs text-gray-500">
                            Data will be stored on Walrus and hash will be auto-generated
                          </p>
                        </div>
                      )}

                      {/* File Upload */}
                      {requestInputType === 'file' && (
                        <div>
                          <label
                            htmlFor="requestFile"
                            className="mb-2 block text-sm font-medium text-gray-700"
                          >
                            Upload Request File <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="file"
                              id="requestFile"
                              onChange={(e) => setRequestFile(e.target.files?.[0] || null)}
                              className="hidden"
                              required
                            />
                            <label
                              htmlFor="requestFile"
                              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 transition-colors hover:border-primary hover:bg-blue-50"
                            >
                              <FontAwesomeIcon icon={faUpload} className="h-6 w-6 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {requestFile ? requestFile.name : 'Click to upload file'}
                              </span>
                            </label>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            File will be uploaded to Walrus and hash will be auto-generated
                          </p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={
                          loading ||
                          (requestInputType === 'text' && !requestText.trim()) ||
                          (requestInputType === 'file' && !requestFile)
                        }
                        className="flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? (
                          <>
                            <FontAwesomeIcon
                              icon={faSpinner}
                              className="mr-2 h-5 w-5 animate-spin"
                            />
                            {uploadingToWalrus ? 'Uploading to Walrus...' : 'Sending...'}
                          </>
                        ) : (
                          'Send Validation Request'
                        )}
                      </button>
                    </form>
                  </div>
                )
              ) : (
                <div className="space-y-6">
                  <div>
                    <h2 className="mb-2 text-2xl font-bold text-gray-900">Respond to Validation</h2>
                    <p className="text-gray-600">Submit your validation response for a request</p>
                  </div>

                  <form onSubmit={handleValidationResponse} className="space-y-6">
                    <div>
                      <label
                        htmlFor="responseHash"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Request Hash
                      </label>
                      <input
                        type="text"
                        id="responseHash"
                        value={responseHash}
                        onChange={(e) => setResponseHash(e.target.value)}
                        placeholder="Hash of the request you're responding to"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-3 block text-sm font-medium text-gray-700">
                        Response Status
                      </label>
                      <div className="grid grid-cols-3 gap-4">
                        <button
                          type="button"
                          onClick={() => setResponse(0)}
                          className={`rounded-lg border-2 px-4 py-3 transition-all ${
                            response === 0
                              ? 'border-red-500 bg-red-50 font-semibold text-red-700'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          Rejected (0)
                        </button>
                        <button
                          type="button"
                          onClick={() => setResponse(1)}
                          className={`rounded-lg border-2 px-4 py-3 transition-all ${
                            response === 1
                              ? 'border-green-500 bg-green-50 font-semibold text-green-700'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          Approved (1)
                        </button>
                        <button
                          type="button"
                          onClick={() => setResponse(2)}
                          className={`rounded-lg border-2 px-4 py-3 transition-all ${
                            response === 2
                              ? 'border-yellow-500 bg-yellow-50 font-semibold text-yellow-700'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          ⏳ Pending (2)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="responseUri"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Response URI
                      </label>
                      <input
                        type="text"
                        id="responseUri"
                        value={responseUri}
                        onChange={(e) => setResponseUri(e.target.value)}
                        placeholder="ipfs://QmYourResponseData"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="responseTag"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Tag <span className="text-gray-400">(optional)</span>
                      </label>
                      <input
                        type="text"
                        id="responseTag"
                        value={responseTag}
                        onChange={(e) => setResponseTag(e.target.value)}
                        placeholder="validation-type, category, etc."
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full items-center justify-center rounded-lg bg-secondary px-6 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} className="mr-2 h-5 w-5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Response'
                      )}
                    </button>
                  </form>
                </div>
              )}

              {result && (
                <div
                  className={`mt-6 rounded-lg p-4 ${result.includes('Error') ? 'border border-red-200 bg-red-50 text-red-800' : 'border border-green-200 bg-green-50 text-green-800'}`}
                >
                  <p className="break-all text-sm">{result}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Information (1/3 width) */}
        <div className="space-y-6">
          {/* Validation System Info */}
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-bold text-gray-900">Validation System</h3>
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-primary">Request Validation</h4>
                <p className="text-sm text-gray-700">
                  Agent owners request validation from trusted validators to verify their agent's
                  interactions and build credibility.
                </p>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h4 className="mb-2 text-sm font-semibold text-secondary">Respond to Requests</h4>
                <p className="text-sm text-gray-700">
                  Validators verify agent interactions and respond with approval, rejection, or
                  pending status.
                </p>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-700">
                  <strong>On-chain transparency:</strong> All validations are permanently recorded
                  on-chain for full accountability.
                </p>
              </div>
            </div>
          </div>

          {/* Response Status Guide */}
          {activeTab === 'respond' && (
            <div className="rounded-xl bg-white p-6 shadow-lg">
              <h3 className="mb-4 text-lg font-bold text-gray-900">Response Status Guide</h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="font-bold text-green-600">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Approved (1)</p>
                    <p className="text-xs text-gray-600">Agent meets validation criteria</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="font-bold text-red-600">✗</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Rejected (0)</p>
                    <p className="text-xs text-gray-600">Agent fails validation requirements</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="font-bold text-yellow-600">⏳</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Pending (2)</p>
                    <p className="text-xs text-gray-600">Needs more time or information</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Best Practices */}
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-bold text-gray-900">
              {activeTab === 'request' ? 'Request Guidelines' : 'Validator Guidelines'}
            </h3>
            <ul className="space-y-3 text-sm text-gray-700">
              {activeTab === 'request' ? (
                <>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      Choose <strong>trusted validators</strong> with good reputation
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      Provide <strong>complete request data</strong> via URI
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      Include proper <strong>hash verification</strong> for data integrity
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      Track validation status to <strong>build credibility</strong>
                    </span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex gap-2">
                    <span className="text-secondary">•</span>
                    <span>
                      <strong>Verify all claims</strong> before responding
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-secondary">•</span>
                    <span>
                      Provide <strong>detailed response URI</strong> with findings
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-secondary">•</span>
                    <span>
                      Use <strong>tags</strong> to categorize validation types
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-secondary">•</span>
                    <span>
                      Maintain <strong>consistency and fairness</strong> in responses
                    </span>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
