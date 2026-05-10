import { detectAudioSupport } from "@/lib/audio/support"

import type { VoiceAssistantApi } from "./useVoiceAssistant"

export type SpeechRecognitionFacade = {
  isSupported: boolean
  status: VoiceAssistantApi["status"]
  start: VoiceAssistantApi["start"]
  stop: VoiceAssistantApi["endSession"]
  transcript: string
  interimTranscript: string
}

/**
 * Brief-vocabulary facade over the Gemini Live recognition path. The actual
 * recognition is performed server-side; this exposes the running transcript
 * stream so callers can use a familiar API.
 */
export function useSpeechRecognition(
  assistant: VoiceAssistantApi
): SpeechRecognitionFacade {
  const support = detectAudioSupport()
  const finalText = assistant.userTurns
    .map((t) => t.text)
    .join(" ")
    .trim()
  return {
    isSupported: support.ok,
    status: assistant.status,
    start: assistant.start,
    stop: assistant.endSession,
    transcript: finalText,
    interimTranscript: assistant.userDraft,
  }
}
