'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faLock,
  faRocket,
  faStore,
  faUser,
  faPlus,
  faShieldAlt,
  faStar,
} from '@fortawesome/free-solid-svg-icons'
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit'
import { useState } from 'react'
import AgentList from '@/components/AgentList'
import RegisterAgent from '@/components/RegisterAgent'
import AgentMarketplace from '@/components/AgentMarketplace'
import AgentDetails from '@/components/AgentDetails'
import GiveFeedback from '@/components/GiveFeedback'
import ValidationComponent from '@/components/ValidationComponent'
import type { Agent } from '@/types'

type ViewType =
  | 'marketplace'
  | 'register'
  | 'myAgents'
  | 'validation'
  | 'agentDetails'
  | 'giveFeedback'

export default function Home() {
  const account = useCurrentAccount()
  const [currentView, setCurrentView] = useState<ViewType>('marketplace')
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent)
    setCurrentView('agentDetails')
  }

  const handleBackToMarketplace = () => {
    setCurrentView('marketplace')
    setSelectedAgent(null)
  }

  const handleGiveFeedback = () => {
    setCurrentView('giveFeedback')
  }

  const handleRequestValidation = () => {
    setCurrentView('validation')
  }

  const renderContent = () => {
    if (!account) {
      return (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <div className="mb-8">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-blue-600">
              <FontAwesomeIcon icon={faLock} className="h-12 w-12 text-white" />
            </div>
            <h2 className="mb-3 text-3xl font-bold text-gray-900">Welcome to agent8004</h2>
            <p className="mb-8 text-lg text-gray-600">
              Connect your Sui wallet to explore, register, and interact with AI agents
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>

          <div className="mt-12 grid gap-6 text-left md:grid-cols-3">
            <div className="rounded-lg bg-blue-50 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <FontAwesomeIcon icon={faStore} className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Discover Agents</h3>
              <p className="text-sm text-gray-600">
                Browse the marketplace and find AI agents for your needs
              </p>
            </div>

            <div className="rounded-lg bg-green-50 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <FontAwesomeIcon icon={faStar} className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Rate & Review</h3>
              <p className="text-sm text-gray-600">
                Share your experience and help build agent reputation
              </p>
            </div>

            <div className="rounded-lg bg-purple-50 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <FontAwesomeIcon icon={faShieldAlt} className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Validate Agents</h3>
              <p className="text-sm text-gray-600">
                Verify agent interactions and build trust in the ecosystem
              </p>
            </div>
          </div>
        </div>
      )
    }

    switch (currentView) {
      case 'marketplace':
        return <AgentMarketplace onSelectAgent={handleSelectAgent} />
      case 'register':
        return <RegisterAgent />
      case 'myAgents':
        return <AgentList onSelectAgent={handleSelectAgent} />
      case 'validation':
        return <ValidationComponent onBack={handleBackToMarketplace} />
      case 'agentDetails':
        return selectedAgent ? (
          <AgentDetails
            agent={selectedAgent}
            onBack={handleBackToMarketplace}
            onGiveFeedback={handleGiveFeedback}
            onRequestValidation={handleRequestValidation}
          />
        ) : null
      case 'giveFeedback':
        return selectedAgent ? (
          <GiveFeedback
            agent={selectedAgent}
            onBack={() => setCurrentView('agentDetails')}
            onSuccess={() => setCurrentView('agentDetails')}
          />
        ) : null
      default:
        return null
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div
              className="flex cursor-pointer items-center"
              onClick={() => setCurrentView('marketplace')}
            >
              <img src="/assets/agent8004-logo.svg" alt="agent8004" className="mr-3 h-10" />
              <div>
                <p className="text-xs text-gray-600">8004 on Sui Blockchain</p>
              </div>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Navigation */}
      {account && (
        <nav className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-1 overflow-x-auto py-2">
              <button
                onClick={() => setCurrentView('marketplace')}
                className={`flex items-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  currentView === 'marketplace'
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FontAwesomeIcon icon={faStore} className="mr-2 h-4 w-4" />
                Marketplace
              </button>
              <button
                onClick={() => setCurrentView('register')}
                className={`flex items-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  currentView === 'register'
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FontAwesomeIcon icon={faPlus} className="mr-2 h-4 w-4" />
                Register Agent
              </button>
              <button
                onClick={() => setCurrentView('myAgents')}
                className={`flex items-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  currentView === 'myAgents'
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FontAwesomeIcon icon={faUser} className="mr-2 h-4 w-4" />
                My Agents
              </button>
              <button
                onClick={() => setCurrentView('validation')}
                className={`flex items-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  currentView === 'validation'
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FontAwesomeIcon icon={faShieldAlt} className="mr-2 h-4 w-4" />
                Validation
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{renderContent()}</div>
    </main>
  )
}
