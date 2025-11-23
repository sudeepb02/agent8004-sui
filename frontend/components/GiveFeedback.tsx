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
            setResult(
              `Success! Feedback submitted. View transaction: https://suiscan.xyz/testnet/tx/${result.digest}`
            )
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
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center text-gray-600 transition-colors hover:text-gray-900"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="mr-2 h-5 w-5" />
        Back to Agent Details
      </button>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Feedback Form (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl bg-white p-8 shadow-lg">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-gray-900">Give Feedback</h2>
              <p className="text-gray-600">Submit your feedback for Agent #{agent.agentId}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Score Slider */}
              <div>
                <label className="mb-3 block text-sm font-medium text-gray-700">
                  Score: <span className="text-2xl font-bold text-primary">{score}</span>/100
                </label>
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={score}
                    onChange={(e) => setScore(parseInt(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
                    style={{ accentColor: '#6366f1' }}
                  />
                  <div className="mt-2 flex justify-between text-xs text-gray-500">
                    <span>Poor (0)</span>
                    <span>Average (50)</span>
                    <span>Excellent (100)</span>
                  </div>
                </div>
              </div>

              {/* Feedback Text */}
              <div>
                <label
                  htmlFor="feedbackText"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Feedback Text <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="feedbackText"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Enter your detailed feedback here... This will be stored on Walrus for permanent verification."
                  rows={8}
                  required
                  className="resize-vertical w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Your feedback will be stored on Walrus and linked on-chain with hash verification
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !feedbackText.trim()}
                className="flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon
                      icon={faSpinner}
                      className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                    />
                    {uploadingToWalrus ? 'Uploading to Walrus...' : 'Submitting...'}
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faCheck} className="mr-2 h-5 w-5" />
                    Submit Feedback
                  </>
                )}
              </button>
            </form>

            {result && (
              <div
                className={`mt-6 rounded-lg p-4 ${result.includes('Error') ? 'border border-red-200 bg-red-50 text-red-800' : 'border border-green-200 bg-green-50 text-green-800'}`}
              >
                {result.includes('https://') ? (
                  <p className="text-sm">
                    {result.split('https://')[0]}
                    <a
                      href={`https://${result.split('https://')[1]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline hover:text-green-900"
                    >
                      View on Suiscan →
                    </a>
                  </p>
                ) : (
                  <p className="break-all text-sm">{result}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Information (1/3 width) */}
        <div className="space-y-6">
          {/* How It Works */}
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-bold text-gray-900">How It Works</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                  1
                </div>
                <p className="text-sm text-gray-700">
                  Your feedback text is stored on Walrus (decentralized storage)
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                  2
                </div>
                <p className="text-sm text-gray-700">The Walrus blob ID becomes the feedback URI</p>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                  3
                </div>
                <p className="text-sm text-gray-700">
                  A SHA-256 hash is generated for verification
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                  4
                </div>
                <p className="text-sm text-gray-700">The URI and hash are recorded on-chain</p>
              </div>
            </div>
          </div>

          {/* Feedback Guidelines */}
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-bold text-gray-900">Feedback Guidelines</h3>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>
                  <strong>Score from 0-100:</strong> Be fair and honest in your assessment
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>
                  <strong>Write detailed feedback</strong> explaining your rating
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>
                  Feedback is stored on <strong>Walrus</strong> decentralized data AVS storage
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>
                  Feedback is <strong>permanently recorded</strong> on-chain with verification
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
