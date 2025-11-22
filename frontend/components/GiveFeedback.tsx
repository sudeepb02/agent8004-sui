'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faSpinner, faCheck } from '@fortawesome/free-solid-svg-icons'
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { useState } from 'react'
import { CONTRACT_CONFIG, MODULES } from '@/config/contracts'
import type { Agent } from '@/types'

interface GiveFeedbackProps {
  agent: Agent
  onBack: () => void
  onSuccess: () => void
}

export default function GiveFeedback({ agent, onBack, onSuccess }: GiveFeedbackProps) {
  const [score, setScore] = useState(50)
  const [fileUri, setFileUri] = useState('')
  const [fileHash, setFileHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const suiClient = useSuiClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult('')

    try {
      const tx = new Transaction()

      tx.moveCall({
        target: `${MODULES.REPUTATION_REGISTRY}::give_feedback`,
        arguments: [
          tx.object(CONTRACT_CONFIG.REPUTATION_REGISTRY_ID),
          tx.pure.u64(agent.agentId),
          tx.pure.u8(score),
          tx.pure.string(fileUri || ''),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(fileHash || ''))),
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
            setResult(`Success! Feedback submitted. Transaction: ${result.digest}`)
            setLoading(false)
            setTimeout(() => {
              onSuccess()
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
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="w-5 h-5 mr-2" />
        Back to Agent Details
      </button>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Give Feedback</h2>
          <p className="text-gray-600">
            Submit your feedback for Agent #{agent.agentId}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Score Slider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Score: <span className="text-2xl font-bold text-primary">{score}</span>/100
            </label>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                value={score}
                onChange={(e) => setScore(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: '#6366f1' }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Poor (0)</span>
                <span>Average (50)</span>
                <span>Excellent (100)</span>
              </div>
            </div>
            
            {/* Visual Score Indicator */}
            <div className="mt-4 p-4 rounded-lg border-2" style={{
              borderColor: score < 30 ? '#ef4444' : score < 70 ? '#f59e0b' : '#10b981',
              backgroundColor: score < 30 ? '#fee2e2' : score < 70 ? '#fef3c7' : '#d1fae5'
            }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{
                  color: score < 30 ? '#991b1b' : score < 70 ? '#92400e' : '#065f46'
                }}>
                  {score < 30 ? 'Poor Performance' : score < 70 ? 'Good Performance' : 'Excellent Performance'}
                </span>
                <span className="text-2xl">
                  {score < 30 ? '(' : score < 70 ? ':)' : ':D'}
                </span>
              </div>
            </div>
          </div>

          {/* File URI */}
          <div>
            <label htmlFor="fileUri" className="block text-sm font-medium text-gray-700 mb-2">
              Feedback File URI <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              id="fileUri"
              value={fileUri}
              onChange={(e) => setFileUri(e.target.value)}
              placeholder="ipfs://QmYourFeedbackFile or https://example.com/feedback.json"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="mt-2 text-sm text-gray-500">
              Link to detailed feedback document
            </p>
          </div>

          {/* File Hash */}
          <div>
            <label htmlFor="fileHash" className="block text-sm font-medium text-gray-700 mb-2">
              File Hash <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              id="fileHash"
              value={fileHash}
              onChange={(e) => setFileHash(e.target.value)}
              placeholder="SHA-256 hash of your feedback file"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
            />
            <p className="mt-2 text-sm text-gray-500">
              Hash for verification purposes
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Submitting...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faCheck} className="w-5 h-5 mr-2" />
                Submit Feedback
              </>
            )}
          </button>
        </form>

        {result && (
          <div className={`mt-6 p-4 rounded-lg ${result.includes('Error') ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
            <p className="text-sm break-all">{result}</p>
          </div>
        )}

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Feedback Guidelines</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Score from 0-100: Be fair and honest in your assessment</li>
            <li>• Optionally attach evidence via file URI (IPFS recommended)</li>
            <li>• Include file hash for verification</li>
            <li>• Feedback is permanently recorded on-chain</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
