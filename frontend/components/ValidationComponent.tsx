'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faSpinner, faUpload, faFileAlt } from '@fortawesome/free-solid-svg-icons'
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { bcs } from '@mysten/sui/bcs'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG, MODULES, STRUCT_TYPES } from '@/config/contracts'
import { storeMetadataWithFlow, readMetadataFromWalrus, extractBlobId } from '@/utils/walrus'
import type { Agent } from '@/types'

interface ValidationComponentProps {
  onBack: () => void
}

export default function ValidationComponent({ onBack }: ValidationComponentProps) {
  const account = useCurrentAccount()
  const [activeTab, setActiveTab] = useState<'request' | 'respond'>('request')
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [selectedRespondAgent, setSelectedRespondAgent] = useState('')
  const [validatorAddress, setValidatorAddress] = useState('')
  const [requestInputType, setRequestInputType] = useState<'text' | 'file'>('text')
  const [requestText, setRequestText] = useState('')
  const [requestFile, setRequestFile] = useState<File | null>(null)
  const [requestUri, setRequestUri] = useState('')
  const [requestHash, setRequestHash] = useState('')
  const [uploadingToWalrus, setUploadingToWalrus] = useState(false)
  const [validationRequests, setValidationRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestData, setRequestData] = useState<{ [key: string]: any }>({})
  const [loadingRequestData, setLoadingRequestData] = useState<{ [key: string]: boolean }>({})
  const [responseText, setResponseText] = useState<{ [key: string]: string }>({})
  const [selectedResponse, setSelectedResponse] = useState<{ [key: string]: number }>({})
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

  useEffect(() => {
    if (selectedRespondAgent && account) {
      loadValidationRequests()
    }
  }, [selectedRespondAgent, account])

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
      if (agentList.length > 0 && !selectedRespondAgent) {
        setSelectedRespondAgent(agentList[0].id)
      }
    } catch (error) {
      console.error('Error loading agents:', error)
    }
  }

  const loadValidationRequests = async () => {
    if (!account || !selectedRespondAgent) return

    setLoadingRequests(true)
    try {
      const selectedAgentData = agents.find((a) => a.id === selectedRespondAgent)
      if (!selectedAgentData) return

      console.log('Loading requests for agent:', {
        agentId: selectedAgentData.agentId,
        validatorAddress: account.address,
      })

      // Query events to find validation requests for this agent
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${CONTRACT_CONFIG.PACKAGE_ID}::validation_registry::ValidationRequestEvent`,
        },
        limit: 50,
      })

      console.log('Total events found:', events.data.length)
      console.log(
        'Events data:',
        events.data.map((e: any) => e.parsedJson)
      )

      // Filter events for the selected agent and where the validator is the current user
      const agentRequests = events.data
        .filter((event: any) => {
          const data = event.parsedJson
          // Convert both to strings for comparison to handle type mismatches
          const eventAgentId = String(data.agent_id)
          const selectedAgentId = String(selectedAgentData.agentId)
          const eventValidator = String(data.validator).toLowerCase()
          const currentValidator = String(account.address).toLowerCase()

          console.log('Comparing:', {
            eventAgentId,
            selectedAgentId,
            match: eventAgentId === selectedAgentId,
            eventValidator,
            currentValidator,
            validatorMatch: eventValidator === currentValidator,
          })

          return eventAgentId === selectedAgentId && eventValidator === currentValidator
        })
        .map((event: any) => ({
          requestHash: event.parsedJson.request_hash,
          agentId: event.parsedJson.agent_id,
          validator: event.parsedJson.validator,
          timestamp: event.timestampMs,
        }))

      console.log('Filtered agent requests:', agentRequests)

      // Fetch request URI from the contract table for each request
      const requestsWithData = await Promise.all(
        agentRequests.map(async (req) => {
          const hashArray = Array.isArray(req.requestHash) ? req.requestHash : []
          let requestUri = ''

          try {
            // Get the parent object (ValidationRegistry) and look for the request in its fields
            const registryObject = await suiClient.getObject({
              id: CONTRACT_CONFIG.VALIDATION_REGISTRY_ID,
              options: {
                showContent: true,
              },
            })

            if (registryObject.data?.content?.dataType === 'moveObject') {
              const fields = (registryObject.data.content as any).fields

              // The requests table ID should be in the fields
              if (fields.requests && fields.requests.fields && fields.requests.fields.id) {
                const tableId = fields.requests.fields.id.id

                // Try to get the dynamic field
                try {
                  const dynamicField = await suiClient.getDynamicFieldObject({
                    parentId: tableId,
                    name: {
                      type: 'vector<u8>',
                      value: hashArray,
                    },
                  })

                  if (dynamicField.data?.content?.dataType === 'moveObject') {
                    const requestFields = (dynamicField.data.content as any).fields.value
                    requestUri = requestFields.request_uri || ''
                    console.log('Found request URI for hash:', hashArray, ':', requestUri)
                  }
                } catch (dfError) {
                  console.error('Error fetching dynamic field:', dfError)
                }
              }
            }
          } catch (error) {
            console.error('Error fetching request details:', error)
          }

          return { ...req, requestUri }
        })
      )

      console.log('Requests with URIs:', requestsWithData)
      setValidationRequests(requestsWithData)

      // Load request data from Walrus for each request
      requestsWithData.forEach(async (req) => {
        const hashKey = Array.isArray(req.requestHash) ? req.requestHash.join(',') : req.requestHash

        if (req.requestUri) {
          setLoadingRequestData((prev) => ({ ...prev, [hashKey]: true }))

          try {
            if (req.requestUri.startsWith('walrus://')) {
              console.log('Fetching from Walrus:', req.requestUri)
              const metadata = await readMetadataFromWalrus(extractBlobId(req.requestUri))
              console.log('Loaded metadata:', metadata)
              setRequestData((prev) => ({ ...prev, [hashKey]: metadata }))
            } else {
              setRequestData((prev) => ({
                ...prev,
                [hashKey]: { info: 'Not a Walrus URI', uri: req.requestUri },
              }))
            }
          } catch (error) {
            console.error('Error loading request data from Walrus:', error)
            setRequestData((prev) => ({
              ...prev,
              [hashKey]: { error: 'Failed to load data from Walrus', uri: req.requestUri },
            }))
          } finally {
            setLoadingRequestData((prev) => ({ ...prev, [hashKey]: false }))
          }
        } else {
          setRequestData((prev) => ({
            ...prev,
            [hashKey]: { error: 'No request URI found in contract' },
          }))
          setLoadingRequestData((prev) => ({ ...prev, [hashKey]: false }))
        }
      })

      // Initialize response states for each request
      const initialResponses: { [key: string]: number } = {}
      const initialTexts: { [key: string]: string } = {}
      agentRequests.forEach((req: any) => {
        const hashKey = Array.isArray(req.requestHash) ? req.requestHash.join(',') : req.requestHash
        initialResponses[hashKey] = 2 // Default to pending
        initialTexts[hashKey] = ''
      })
      setSelectedResponse(initialResponses)
      setResponseText(initialTexts)
    } catch (error) {
      console.error('Error loading validation requests:', error)
    } finally {
      setLoadingRequests(false)
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

  const handleValidationResponse = async (requestHash: any, responseStatus: number) => {
    if (!account) return

    setLoading(true)
    setResult('')

    try {
      const hashKey = Array.isArray(requestHash) ? requestHash.join(',') : requestHash
      const hashArray = Array.isArray(requestHash)
        ? requestHash
        : Array.from(new TextEncoder().encode(requestHash))

      let finalResponseUri = ''
      let finalResponseHash = ''

      // If response text is provided, upload to Walrus
      if (responseText[hashKey] && responseText[hashKey].trim()) {
        setUploadingToWalrus(true)
        setResult('Uploading response data to Walrus...')

        const responseData = {
          type: 'validation-response',
          requestHash: hashKey,
          response: responseStatus,
          content: responseText[hashKey],
          timestamp: new Date().toISOString(),
          validator: account.address,
        }

        const { blobId, walrusUri } = await storeMetadataWithFlow(
          responseData as any,
          account.address,
          signAndExecute,
          suiClient,
          10
        )

        finalResponseUri = walrusUri

        // Generate hash from response data
        const dataBytes = new TextEncoder().encode(JSON.stringify(responseData))
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        finalResponseHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

        setUploadingToWalrus(false)
        setResult('Response data uploaded. Submitting on-chain...')
      } else {
        // No response text, use empty values
        finalResponseUri = ''
        finalResponseHash = ''
      }

      const tx = new Transaction()

      tx.moveCall({
        target: `${MODULES.VALIDATION_REGISTRY}::validation_response`,
        arguments: [
          tx.object(CONTRACT_CONFIG.VALIDATION_REGISTRY_ID),
          tx.pure(bcs.vector(bcs.u8()).serialize(new Uint8Array(hashArray))),
          tx.pure.u8(responseStatus),
          tx.pure(bcs.vector(bcs.u8()).serialize(new TextEncoder().encode(finalResponseUri))),
          tx.pure(bcs.vector(bcs.u8()).serialize(new TextEncoder().encode(finalResponseHash))),
          tx.pure(bcs.vector(bcs.u8()).serialize(new TextEncoder().encode(''))), // tag
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
            setLoading(false)
            // Reload requests to show updated status
            setTimeout(() => {
              loadValidationRequests()
            }, 2000)
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
                    <p className="text-gray-600">
                      Review and respond to validation requests for your agents
                    </p>
                  </div>

                  {agents.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="mb-4 text-gray-600">You need to register an agent first.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Agent Selection */}
                      <div>
                        <label
                          htmlFor="respondAgent"
                          className="mb-2 block text-sm font-medium text-gray-700"
                        >
                          Select Agent
                        </label>
                        <select
                          id="respondAgent"
                          value={selectedRespondAgent}
                          onChange={(e) => setSelectedRespondAgent(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                        >
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name || `Agent ${agent.agentId}`} (ID: {agent.agentId})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Validation Requests List */}
                      {loadingRequests ? (
                        <div className="flex items-center justify-center py-12">
                          <FontAwesomeIcon
                            icon={faSpinner}
                            className="mr-2 h-8 w-8 animate-spin text-primary"
                          />
                          <span className="text-gray-600">Loading validation requests...</span>
                        </div>
                      ) : validationRequests.length === 0 ? (
                        <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
                          <p className="text-gray-600">
                            No validation requests found for this agent where you are the validator.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900">
                            Pending Requests ({validationRequests.length})
                          </h3>

                          {validationRequests.map((request, idx) => {
                            const hashKey = Array.isArray(request.requestHash)
                              ? request.requestHash.join(',')
                              : request.requestHash
                            const responseStatus = selectedResponse[hashKey] || 2

                            return (
                              <div
                                key={idx}
                                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
                              >
                                <div className="mb-4 flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                      Validation Request #{idx + 1}
                                    </h4>
                                    <p className="mb-1 text-xs text-gray-600">
                                      <span className="font-medium">Agent ID:</span>{' '}
                                      {request.agentId}
                                    </p>
                                    <p className="mb-1 text-xs text-gray-600">
                                      <span className="font-medium">Request Hash:</span>{' '}
                                      <span className="break-all font-mono">
                                        {Array.isArray(request.requestHash)
                                          ? '0x' +
                                            request.requestHash
                                              .map((b: number) => b.toString(16).padStart(2, '0'))
                                              .join('')
                                              .slice(0, 32) +
                                            '...'
                                          : request.requestHash.slice(0, 32) + '...'}
                                      </span>
                                    </p>
                                    {request.requestUri && (
                                      <p className="mb-1 text-xs text-gray-600">
                                        <span className="font-medium">Request URI:</span>{' '}
                                        <a
                                          href={request.requestUri}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="break-all font-mono text-primary hover:underline"
                                        >
                                          {request.requestUri}
                                        </a>
                                      </p>
                                    )}
                                    <p className="text-xs text-gray-500">
                                      {new Date(parseInt(request.timestamp)).toLocaleString()}
                                    </p>
                                  </div>
                                </div>

                                {/* Request Data */}
                                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                  <h5 className="mb-2 text-sm font-semibold text-gray-900">
                                    Request Data
                                  </h5>
                                  {loadingRequestData[hashKey] ? (
                                    <div className="flex items-center gap-2 py-4 text-sm text-gray-600">
                                      <FontAwesomeIcon
                                        icon={faSpinner}
                                        className="h-4 w-4 animate-spin"
                                      />
                                      Loading request data from Walrus...
                                    </div>
                                  ) : requestData[hashKey] ? (
                                    <div className="space-y-2">
                                      {requestData[hashKey].error ? (
                                        <div className="text-sm">
                                          <p className="text-red-600">
                                            {requestData[hashKey].error}
                                          </p>
                                          {requestData[hashKey].uri && (
                                            <p className="mt-2 text-xs text-gray-600">
                                              <span className="font-medium">URI:</span>{' '}
                                              <a
                                                href={requestData[hashKey].uri}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline"
                                              >
                                                {requestData[hashKey].uri}
                                              </a>
                                            </p>
                                          )}
                                        </div>
                                      ) : requestData[hashKey].info ? (
                                        <div className="text-sm">
                                          <p className="text-gray-600">
                                            {requestData[hashKey].info}
                                          </p>
                                          {requestData[hashKey].uri && (
                                            <p className="mt-2 text-xs text-gray-600">
                                              <span className="font-medium">URI:</span>{' '}
                                              <a
                                                href={requestData[hashKey].uri}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline"
                                              >
                                                {requestData[hashKey].uri}
                                              </a>
                                            </p>
                                          )}
                                        </div>
                                      ) : (
                                        <>
                                          {requestData[hashKey].content && (
                                            <div>
                                              <p className="mb-1 text-xs font-medium text-gray-700">
                                                Content:
                                              </p>
                                              <div className="max-h-32 overflow-y-auto rounded border border-gray-300 bg-white p-3">
                                                <p className="whitespace-pre-wrap text-xs text-gray-900">
                                                  {requestData[hashKey].content}
                                                </p>
                                              </div>
                                            </div>
                                          )}
                                          {requestData[hashKey].fileName && (
                                            <p className="text-xs text-gray-600">
                                              <span className="font-medium">File:</span>{' '}
                                              {requestData[hashKey].fileName}
                                            </p>
                                          )}
                                          {requestData[hashKey].timestamp && (
                                            <p className="text-xs text-gray-600">
                                              <span className="font-medium">Submitted:</span>{' '}
                                              {new Date(
                                                requestData[hashKey].timestamp
                                              ).toLocaleString()}
                                            </p>
                                          )}
                                          {requestData[hashKey].requester && (
                                            <p className="text-xs text-gray-600">
                                              <span className="font-medium">Requester:</span>{' '}
                                              <span className="font-mono">
                                                {requestData[hashKey].requester.slice(0, 6)}...
                                                {requestData[hashKey].requester.slice(-4)}
                                              </span>
                                            </p>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-gray-500">
                                      {request.requestUri
                                        ? 'Waiting to load request data...'
                                        : 'No request URI available'}
                                    </p>
                                  )}
                                </div>

                                {/* Response Status Buttons */}
                                <div className="mb-4">
                                  <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Your Response
                                  </label>
                                  <div className="grid grid-cols-2 gap-4">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedResponse({ ...selectedResponse, [hashKey]: 1 })
                                      }
                                      disabled={loading}
                                      className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all ${
                                        responseStatus === 1
                                          ? 'border-green-500 bg-green-500 text-white shadow-md'
                                          : 'border-green-500 bg-white text-green-700 hover:bg-green-50'
                                      }`}
                                    >
                                      <span className="text-lg">✓</span> Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedResponse({ ...selectedResponse, [hashKey]: 0 })
                                      }
                                      disabled={loading}
                                      className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all ${
                                        responseStatus === 0
                                          ? 'border-red-500 bg-red-500 text-white shadow-md'
                                          : 'border-red-500 bg-white text-red-700 hover:bg-red-50'
                                      }`}
                                    >
                                      <span className="text-lg">✗</span> Reject
                                    </button>
                                  </div>
                                </div>

                                {/* Optional Response Text */}
                                <div className="mb-4">
                                  <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Response Details{' '}
                                    <span className="font-normal text-gray-400">(optional)</span>
                                  </label>
                                  <textarea
                                    value={responseText[hashKey] || ''}
                                    onChange={(e) =>
                                      setResponseText({
                                        ...responseText,
                                        [hashKey]: e.target.value,
                                      })
                                    }
                                    placeholder="Add optional details about your validation... This will be stored on Walrus."
                                    rows={3}
                                    disabled={loading}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-primary disabled:bg-gray-50"
                                  />
                                  <p className="mt-1 text-xs text-gray-500">
                                    If provided, will be uploaded to Walrus with auto-generated hash
                                  </p>
                                </div>

                                {/* Submit Button */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleValidationResponse(request.requestHash, responseStatus)
                                  }
                                  disabled={loading}
                                  className="flex w-full items-center justify-center rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {loading ? (
                                    <>
                                      <FontAwesomeIcon
                                        icon={faSpinner}
                                        className="mr-2 h-4 w-4 animate-spin"
                                      />
                                      {uploadingToWalrus ? 'Uploading...' : 'Submitting...'}
                                    </>
                                  ) : (
                                    'Submit Response'
                                  )}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
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
