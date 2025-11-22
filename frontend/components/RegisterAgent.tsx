'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRocket, faSpinner, faLink } from '@fortawesome/free-solid-svg-icons'
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { useState } from 'react'
import { CONTRACT_CONFIG, MODULES } from '@/config/contracts'

export default function RegisterAgent() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [tokenUri, setTokenUri] = useState('')
  const [endpointName, setEndpointName] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [endpointVersion, setEndpointVersion] = useState('1.0.0')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const suiClient = useSuiClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult('')

    try {
      const tx = new Transaction()

      // Call the register function with all required parameters
      // Pass empty array for endpoints for now, @todo add enpoints later
      tx.moveCall({
        target: `${MODULES.IDENTITY_REGISTRY}::register`,
        arguments: [
          tx.object(CONTRACT_CONFIG.IDENTITY_REGISTRY_ID),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(name))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(description))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(image))),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(tokenUri))),
          tx.pure(new Uint8Array([0])), // Empty vector - 0 length
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
            setResult(`Success! Transaction: ${result.digest}`)
            // Clear form
            setName('')
            setDescription('')
            setImage('')
            setTokenUri('')
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
        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Agent Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My AI Agent"
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
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your agent's capabilities and purpose"
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
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://example.com/agent-image.png or ipfs://..."
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="mt-2 text-sm text-gray-500">
              URL to your agent's profile image
            </p>
          </div>

          <div>
            <label htmlFor="tokenUri" className="block text-sm font-medium text-gray-700 mb-2">
              Token URI <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FontAwesomeIcon icon={faLink} className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="tokenUri"
                value={tokenUri}
                onChange={(e) => setTokenUri(e.target.value)}
                placeholder="ipfs://QmYourAgentMetadata or https://example.com/agent.json"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              URI pointing to your agent's metadata file (IPFS, HTTPS, Arweave, etc.)
            </p>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Endpoint Configuration (Optional)</h3>
            
            <div className="space-y-4">
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
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !name || !description || !image || !tokenUri}
            className="w-full bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
          >
            {loading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="animate-spin h-5 w-5 mr-2" />
                Registering...
              </>
            ) : (
              'Register Agent'
            )}
          </button>
        </form>
      </div>

      {result && (
        <div className={`p-4 rounded-lg ${result.includes('Error') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
          <p className="text-sm break-all">{result}</p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Registration Tips</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• All fields except endpoints are required</li>
          <li>• Token URI should point to a JSON metadata file</li>
          <li>• Image URL will be displayed as your agent's avatar</li>
          <li>• Endpoints are optional but recommended for API access</li>
        </ul>
      </div>
    </div>
  )
}
