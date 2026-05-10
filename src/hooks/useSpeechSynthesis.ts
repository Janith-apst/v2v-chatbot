import { detectAudioSupport } from "@/lib/audio/support"

import type { VoiceAssistantApi } from "./useVoiceAssistant"

export type SpeechSynthesisFacade = {
  isSupported: boolean
  isSpeaking: boolean
  lastSpokenText: string | null
  /** No-op for the Gemini path; the assistant initiates its own speech. */
  speak: (text: string) => void
  stop: () => void
  repeat: () => void
}

/**
 * Brief-vocabulary facade over the Gemini Live playback path. The model
 * speaks autonomously, so `speak()` is a no-op; `stop()` flushes the player,
 * `repeat()` replays the last fully-received turn.
 */
export function useSpeechSynthesis(
  assistant: VoiceAssistantApi
): SpeechSynthesisFacade {
  const support = detectAudioSupport()
  const lastAssistant = assistant.assistantTurns.at(-1)?.text ?? null
  return {
    isSupported: support.ok,
    isSpeaking: assistant.status === "speaking",
    lastSpokenText: lastAssistant,
    speak: () => {
      // Intentional no-op: model controls its own speech in the Gemini Live
      // architecture. Retained for API compatibility with the brief.
    },
    stop: assistant.stopSpeaking,
    repeat: assistant.repeatLastResponse,
  }
}
