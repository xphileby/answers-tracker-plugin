export type AnswerEntry = {
  /** The transcript row's id: what `ui.render` sees as `requestId` and `$.ui.scroll` takes. */
  id: string
  role: 'user' | 'assistant'
  /** The loop the row belongs to: a subagent's id; absent for the main conversation. */
  agentId?: string
  /** The first meaningful line of the message, bounded. */
  text: string
  /** When it was indexed, ms since the epoch. */
  at: number
  /** An assistant row that closed a turn: the answer the person waited for. */
  isFinal: boolean
  /** Whether the transcript's viewport shows it now. */
  onScreen: boolean
}

declare module 'claude-code' {
  interface PluginState {
    answers: { items: AnswerEntry[]; showAll: boolean }
  }
}
