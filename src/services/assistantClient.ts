// Re-export under the brief's vocabulary. The implementation lives in
// src/lib/gemini/live-client.ts and is unchanged.
export { GeminiLiveClient as AssistantClient } from "@/lib/gemini/live-client"
export type {
  GeminiLiveEvents as AssistantClientEvents,
  GeminiLiveOptions as AssistantClientOptions,
} from "@/lib/gemini/live-client"
