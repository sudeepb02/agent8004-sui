export interface Agent {
  id: string
  agentId: string
  tokenUri: string
  owner: string
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
