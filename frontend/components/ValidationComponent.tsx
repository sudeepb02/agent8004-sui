'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG, MODULES, STRUCT_TYPES } from '@/config/contracts'
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
  const [requestUri, setRequestUri] = useState('')
  const [requestHash, setRequestHash] = useState('')
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
          tokenUri: obj.data.content.fields.token_uri,
          owner: obj.data.content.fields.owner,
        }))

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
    if (!selectedAgent) return

    setLoading(true)
    setResult('')

    try {
      const tx = new Transaction()

      const requestUriBytes = new Uint8Array(new TextEncoder().encode(requestUri))
      const requestHashBytes = new Uint8Array(new TextEncoder().encode(requestHash))

      tx.moveCall({
        target: `${MODULES.VALIDATION_REGISTRY}::validation_request`,
        arguments: [
          tx.object(CONTRACT_CONFIG.VALIDATION_REGISTRY_ID),
          tx.object(selectedAgent),
          tx.pure.address(validatorAddress),
          tx.pure(requestUriBytes),
          tx.pure(requestHashBytes),
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
            setValidatorAddress('')
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
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="w-5 h-5 mr-2" />
        Back
      </button>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('request')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'request'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Request Validation
            </button>
            <button
              onClick={() => setActiveTab('respond')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'respond'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Respond to Request
            </button>
          </nav>
        </div>

        <div className="p-8">
          {activeTab === 'request' ? (
            agents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-4">You need to register an agent first.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Validation</h2>
                  <p className="text-gray-600">
                    Request a validator to verify your agent's interactions
                  </p>
                </div>

                <form onSubmit={handleValidationRequest} className="space-y-6">
                  <div>
                    <label htmlFor="agent" className="block text-sm font-medium text-gray-700 mb-2">
                      Select Agent
                    </label>
                    <select
                      id="agent"
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          Agent #{agent.agentId} - {agent.id.slice(0, 16)}...
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="validator" className="block text-sm font-medium text-gray-700 mb-2">
                      Validator Address
                    </label>
                    <input
                      type="text"
                      id="validator"
                      value={validatorAddress}
                      onChange={(e) => setValidatorAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="requestUri" className="block text-sm font-medium text-gray-700 mb-2">
                      Request URI
                    </label>
                    <input
                      type="text"
                      id="requestUri"
                      value={requestUri}
                      onChange={(e) => setRequestUri(e.target.value)}
                      placeholder="ipfs://QmYourRequestData"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="requestHash" className="block text-sm font-medium text-gray-700 mb-2">
                      Request Hash
                    </label>
                    <input
                      type="text"
                      id="requestHash"
                      value={requestHash}
                      onChange={(e) => setRequestHash(e.target.value)}
                      placeholder="Hash of the validation request"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Sending...' : 'Send Validation Request'}
                  </button>
                </form>
              </div>
            )
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Respond to Validation</h2>
                <p className="text-gray-600">
                  Submit your validation response for a request
                </p>
              </div>

              <form onSubmit={handleValidationResponse} className="space-y-6">
                <div>
                  <label htmlFor="responseHash" className="block text-sm font-medium text-gray-700 mb-2">
                    Request Hash
                  </label>
                  <input
                    type="text"
                    id="responseHash"
                    value={responseHash}
                    onChange={(e) => setResponseHash(e.target.value)}
                    placeholder="Hash of the request you're responding to"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Response Status
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => setResponse(0)}
                      className={`px-4 py-3 rounded-lg border-2 transition-all ${
                        response === 0
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      Rejected (0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setResponse(1)}
                      className={`px-4 py-3 rounded-lg border-2 transition-all ${
                        response === 1
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      Approved (1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setResponse(2)}
                      className={`px-4 py-3 rounded-lg border-2 transition-all ${
                        response === 2
                          ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      ⏳ Pending (2)
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="responseUri" className="block text-sm font-medium text-gray-700 mb-2">
                    Response URI
                  </label>
                  <input
                    type="text"
                    id="responseUri"
                    value={responseUri}
                    onChange={(e) => setResponseUri(e.target.value)}
                    placeholder="ipfs://QmYourResponseData"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="responseTag" className="block text-sm font-medium text-gray-700 mb-2">
                    Tag <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="responseTag"
                    value={responseTag}
                    onChange={(e) => setResponseTag(e.target.value)}
                    placeholder="validation-type, category, etc."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-secondary text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Submitting...' : 'Submit Response'}
                </button>
              </form>
            </div>
          )}

          {result && (
            <div className={`mt-6 p-4 rounded-lg ${result.includes('Error') ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
              <p className="text-sm break-all">{result}</p>
            </div>
          )}

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Validation System</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Request:</strong> Agent owners request validation from trusted validators</li>
              <li>• <strong>Respond:</strong> Validators verify and respond to validation requests</li>
              <li>• All validations are recorded on-chain for transparency</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
