'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock, faRocket, faStore, faUser, faPlus, faDatabase, faShieldAlt, faStar } from '@fortawesome/free-solid-svg-icons'
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit'
import { useState } from 'react'
import AgentList from '@/components/AgentList'
import RegisterAgent from '@/components/RegisterAgent'
import SetMetadata from '@/components/SetMetadata'
import AgentMarketplace from '@/components/AgentMarketplace'
import AgentDetails from '@/components/AgentDetails'
import GiveFeedback from '@/components/GiveFeedback'
import ValidationComponent from '@/components/ValidationComponent'
import type { Agent } from '@/types'

type ViewType = 'marketplace' | 'register' | 'myAgents' | 'metadata' | 'validation' | 'agentDetails' | 'giveFeedback'

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
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="mb-8">
            <div className="mx-auto w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mb-6">
              <FontAwesomeIcon icon={faLock} className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Welcome to Agent Marketplace</h2>
            <p className="text-gray-600 text-lg mb-8">
              Connect your Sui wallet to explore, register, and interact with AI agents
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-12 text-left">
            <div className="bg-blue-50 rounded-lg p-6">
              <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <FontAwesomeIcon icon={faStore} className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Discover Agents</h3>
              <p className="text-gray-600 text-sm">Browse the marketplace and find AI agents for your needs</p>
            </div>

            <div className="bg-green-50 rounded-lg p-6">
              <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <FontAwesomeIcon icon={faStar} className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Rate & Review</h3>
              <p className="text-gray-600 text-sm">Share your experience and help build agent reputation</p>
            </div>

            <div className="bg-purple-50 rounded-lg p-6">
              <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <FontAwesomeIcon icon={faShieldAlt} className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Validate Agents</h3>
              <p className="text-gray-600 text-sm">Verify agent interactions and build trust in the ecosystem</p>
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
      case 'metadata':
        return <SetMetadata />
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
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center cursor-pointer" onClick={() => setCurrentView('marketplace')}>
              <div className="bg-blue-600 w-10 h-10 rounded-lg flex items-center justify-center mr-3">
                <FontAwesomeIcon icon={faRocket} className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Agent Marketplace</h1>
                <p className="text-xs text-gray-600">ERC-8004 on Sui Blockchain</p>
              </div>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Navigation */}
      {account && (
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-1 overflow-x-auto py-2">
              <button
                onClick={() => setCurrentView('marketplace')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center ${
                  currentView === 'marketplace'
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FontAwesomeIcon icon={faStore} className="w-4 h-4 mr-2" />
                Marketplace
              </button>
              <button
                onClick={() => setCurrentView('register')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center ${
                  currentView === 'register'
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4 mr-2" />
                Register Agent
              </button>
              <button
                onClick={() => setCurrentView('myAgents')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center ${
                  currentView === 'myAgents'
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FontAwesomeIcon icon={faUser} className="w-4 h-4 mr-2" />
                My Agents
              </button>
              <button
                onClick={() => setCurrentView('metadata')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center ${
                  currentView === 'metadata'
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FontAwesomeIcon icon={faDatabase} className="w-4 h-4 mr-2" />
                Metadata
              </button>
              <button
                onClick={() => setCurrentView('validation')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center ${
                  currentView === 'validation'
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FontAwesomeIcon icon={faShieldAlt} className="w-4 h-4 mr-2" />
                Validation
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </div>
    </main>
  )
}
