// The Lab Assistant's service seam. The panel talks only to this interface.
// Today it is the rule-based mock (mock/api/assistant.ts, reading the same
// state as the dashboard). A backend or AI service can implement the same
// contract later (POST /api/assistant/ask) without changing the panel.

import { labApi, type AssistantIntent, type AssistantReply } from './lab-api'

export interface AssistantService {
  /** One-tap questions to offer. */
  suggestions(): AssistantIntent[]
  ask(question: {
    intent?: AssistantIntent
    text?: string
  }): Promise<AssistantReply>
}

export const assistantService: AssistantService = {
  suggestions: () => labApi.assistant.suggestions(),
  ask: (question) => labApi.assistant.ask(question),
}
