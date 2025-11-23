'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faSpinner, faCheck } from '@fortawesome/free-solid-svg-icons'
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { useState } from 'react'
import { CONTRACT_CONFIG, MODULES } from '@/config/contracts'
import type { Agent } from '@/types'
import { storeMetadataWithFlow } from '@/utils/walrus'

interface GiveFeedbackProps {
  agent: Agent
  onBack: () => void
  onSuccess: () => void
}

export default function GiveFeedback({ agent, onBack, onSuccess }: GiveFeedbackProps) {
  const [score, setScore] = useState(50)
  const [feedbackText, setFeedbackText] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadingToWalrus, setUploadingToWalrus] = useState(false)
  const [result, setResult] = useState<string>('')
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const suiClient = useSuiClient()
  const currentAccount = useCurrentAccount()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!feedbackText.trim()) {
      setResult('Error: Please enter feedback text')
      return
    }

    if (!currentAccount) {
      setResult('Error: Please connect your wallet')
      return
    }

    setLoading(true)
    setResult('')

    try {
      // Step 1: Store feedback on Walrus
      setUploadingToWalrus(true)
      setResult('Uploading feedback to Walrus...')
      
      const feedbackData = {
        agentId: agent.agentId,
        score: score,
        feedback: feedbackText,
        timestamp: new Date().toISOString(),
        reviewer: currentAccount.address,
      }

      const { blobId, walrusUri } = await storeMetadataWithFlow(
        feedbackData as any,
        currentAccount.address,
        signAndExecute,
        suiClient,
        10 // Store for 10 epochs
      )

      setUploadingToWalrus(false)
      setResult('Feedback uploaded to Walrus. Submitting on-chain...')

      // Step 2: Generate hash of the feedback data
      const feedbackJson = JSON.stringify(feedbackData)
      const feedbackBytes = new TextEncoder().encode(feedbackJson)
      const hashBuffer = await crypto.subtle.digest('SHA-256', feedbackBytes)
      const hashArray = Array.from(new Uint8Array(hashBuffer))

      // Step 3: Submit feedback transaction
      const tx = new Transaction()

      tx.moveCall({
        target: `${MODULES.REPUTATION_REGISTRY}::give_feedback`,
        arguments: [
          tx.object(CONTRACT_CONFIG.REPUTATION_REGISTRY_ID),
          tx.pure.u64(agent.agentId),
          tx.pure.u8(score),
          tx.pure.string(walrusUri),
          tx.pure.vector('u8', hashArray),
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
      setUploadingToWalrus(false)
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
            <label htmlFor="feedbackText" className="block text-sm font-medium text-gray-700 mb-2">
              Feedback Text <span className="text-red-500">*</span>
            </label>
            <textarea
              id="feedbackText"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Enter your detailed feedback here... This will be stored on Walrus for permanent verification."
              rows={6}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-vertical"
            />
            <p className="mt-2 text-sm text-gray-500">
              Your feedback will be stored on Walrus and linked on-chain with hash verification
            </p>
          </div>

          {/* File Hash */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-1 text-sm">How it works:</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>1. Your feedback text is stored on Walrus (decentralized storage)</li>
              <li>2. The Walrus blob ID becomes the feedback URI</li>
              <li>3. A SHA-256 hash is generated for verification</li>
              <li>4. The URI and hash are recorded on-chain</li>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !feedbackText.trim()}
            className="w-full bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                {uploadingToWalrus ? 'Uploading to Walrus...' : 'Submitting...'}
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
            <li>• Write detailed feedback explaining your rating</li>
            <li>• Feedback is stored on Walrus (decentralized storage)</li>
            <li>• Feedback is permanently recorded on-chain with verification</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
