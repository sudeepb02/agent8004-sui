'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDatabase, faSpinner, faRobot, faLink, faKey, faInfoCircle, faTag } from '@fortawesome/free-solid-svg-icons'
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { useState, useEffect } from 'react'
import { CONTRACT_CONFIG, MODULES, STRUCT_TYPES } from '@/config/contracts'

interface Agent {
  id: string
  agentId: string
}

export default function SetMetadata() {
  const account = useCurrentAccount()
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [metadataKey, setMetadataKey] = useState('')
  const [metadataValue, setMetadataValue] = useState('')
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
        }))

      setAgents(agentList)
      if (agentList.length > 0 && !selectedAgent) {
        setSelectedAgent(agentList[0].id)
      }
    } catch (error) {
      console.error('Error loading agents:', error)
    }
  }

  const handleSetMetadata = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgent) return

    setLoading(true)
    setResult('')

    try {
      const tx = new Transaction()
      
      // Convert string to bytes
      const encoder = new TextEncoder()
      const valueBytes = new Uint8Array(encoder.encode(metadataValue))

      tx.moveCall({
        target: `${MODULES.IDENTITY_REGISTRY}::set_metadata`,
        arguments: [
          tx.object(CONTRACT_CONFIG.IDENTITY_REGISTRY_ID),
          tx.object(selectedAgent),
          tx.pure.string(metadataKey),
          tx.pure(valueBytes),
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
            setResult(`Success! Metadata set. Transaction: ${result.digest}`)
            setMetadataKey('')
            setMetadataValue('')
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
    if (!selectedAgent || !metadataValue) return

    setLoading(true)
    setResult('')

    try {
      const tx = new Transaction()

      tx.moveCall({
        target: `${MODULES.IDENTITY_REGISTRY}::set_token_uri`,
        arguments: [
          tx.object(selectedAgent),
          tx.pure.string(metadataValue),
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
            setMetadataValue('')
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
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M19 9l-7 7-7-7" />
              </svg>
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
                value={metadataValue}
                onChange={(e) => setMetadataValue(e.target.value)}
                placeholder="ipfs://QmYourAgentMetadata"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={handleSetTokenUri}
              disabled={loading || !metadataValue}
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

        {/* Set Custom Metadata */}
        <div className="border border-gray-200 rounded-lg p-6 bg-purple-50">
          <div className="flex items-center mb-4">
            <div className="bg-purple-100 p-2 rounded-lg mr-3">
              <FontAwesomeIcon icon={faTag} className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Set Custom Metadata</h3>
          </div>
          <form onSubmit={handleSetMetadata} className="space-y-4">
            <div>
              <label htmlFor="key" className="block text-sm font-medium text-gray-700 mb-2">
                Metadata Key
              </label>
              <input
                type="text"
                id="key"
                value={metadataKey}
                onChange={(e) => setMetadataKey(e.target.value)}
                placeholder="e.g., agentWallet, agentName, description"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="value" className="block text-sm font-medium text-gray-700 mb-2">
                Metadata Value
              </label>
              <textarea
                id="value"
                value={metadataValue}
                onChange={(e) => setMetadataValue(e.target.value)}
                placeholder="Value for the metadata key"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !metadataKey || !metadataValue}
              className="w-full bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin h-5 w-5 mr-2" />
                  Setting...
                </>
              ) : (
                'Set Metadata'
              )}
            </button>
          </form>
        </div>
      </div>

      {result && (
        <div className={`p-4 rounded-lg animate-in fade-in duration-300 ${result.includes('Error') ? 'bg-red-50 text-red-800 border-2 border-red-200' : 'bg-green-50 text-green-800 border-2 border-green-200'}`}>
          <div className="flex items-start">
            {result.includes('Error') ? (
              <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            <p className="text-sm break-all flex-1">{result}</p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
          <FontAwesomeIcon icon={faInfoCircle} className="w-5 h-5 mr-2" />
          Metadata Management Tips
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span><strong>Common keys:</strong> agentWallet, agentName, description, website</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Metadata is stored permanently on-chain</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Only the agent owner can set metadata</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Update Token URI to change agent profile</span>
          </div>
        </div>
      </div>
    </div>
  )
}
