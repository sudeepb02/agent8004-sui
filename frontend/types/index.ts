export interface Agent {
  id: string
  agentId: string
  tokenUri: string
  owner: string
  metadata?: AgentMetadata
}

export interface AgentMetadata {
  type?: string
  name?: string
  description?: string
  image?: string
  endpoints?: Endpoint[]
  registrations?: Registration[]
  supportedTrust?: string[]
  [key: string]: any
}

export interface Endpoint {
  name: string
  endpoint: string
  version?: string
  capabilities?: Record<string, any>
}

export interface Registration {
  agentId: number
  agentRegistry: string
}

export interface Reputation {
  feedbackCount: number
  averageScore: number
  feedbacks: Feedback[]
}

export interface Feedback {
  score: number
  client: string
  fileUri: string
  fileHash: string
}

export interface ValidationRequest {
  validator: string
  agentId: string
  requestUri: string
  requestHash: string
  responses: ValidationResponse[]
}

export interface ValidationResponse {
  response: number
  responseUri: string
  responseHash: string
  tag: string
}
