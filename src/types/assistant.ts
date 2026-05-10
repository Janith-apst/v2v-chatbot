export type AssistantState =
  | "idle"
  | "ready"
  | "requesting-mic"
  | "permission-required"
  | "connecting"
  | "listening"
  | "processing"
  | "speaking"
  | "stopping"
  | "error"
  | "unsupported"
  | "closed"

export type TranscriptTurn = {
  role: "user" | "assistant"
  text: string
}

export type DebugEvent = {
  at: number
  event: string
  data?: unknown
}
