import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { AudioPlayer } from "@/lib/audio/audio-player"
import { MicRecorder } from "@/lib/audio/mic-recorder"
import { detectAudioSupport } from "@/lib/audio/support"
import { GeminiLiveClient } from "@/lib/gemini/live-client"
import { parse as parseCommand, type Intent } from "@/services/commandParser"
import type {
  AssistantState,
  DebugEvent,
  TranscriptTurn,
} from "@/types/assistant"

import { useAccessibilityAnnouncements } from "./useAccessibilityAnnouncements"
import { useHaptics } from "./useHaptics"
import { useSettings, type SpeechSpeed } from "./useSettings"

const DEBUG_RING_SIZE = 200

const SPEED_RATE: Record<SpeechSpeed, number> = {
  slow: 0.85,
  normal: 1,
  fast: 1.2,
}

const STATE_ANNOUNCEMENTS: Partial<Record<AssistantState, string>> = {
  ready: "Ready. Tap start listening or press space.",
  "requesting-mic": "Requesting microphone permission.",
  "permission-required":
    "Microphone access is needed to hear you.",
  connecting: "Connecting to the assistant.",
  listening: "Listening. Speak now.",
  processing: "Checking that.",
  speaking: "Speaking response. You can interrupt at any time.",
  stopping: "Stopping.",
  closed: "Conversation ended.",
}

export type VoiceAssistantApi = {
  status: AssistantState
  error: string | null
  micMuted: boolean
  isSupported: boolean
  unsupportedReason: string | null
  hasLastResponse: boolean
  userTurns: TranscriptTurn[]
  assistantTurns: TranscriptTurn[]
  userDraft: string
  assistantDraft: string
  debugEvents: DebugEvent[]
  start: () => Promise<void>
  endSession: () => Promise<void>
  stopSpeaking: () => void
  repeatLastResponse: () => void
  toggleMute: () => void
  reset: () => void
  // For dialogs / panels
  openHelp: () => void
  closeHelp: () => void
  helpOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  settingsOpen: boolean
  openDebug: () => void
  closeDebug: () => void
  debugOpen: boolean
  // For voice-command hand-off
  onVoiceCommand?: (intent: Intent) => void
  /** Live AnalyserNode for waveform visualization. Returns null until the player has been initialised. */
  getAnalyser: () => AnalyserNode | null
}

export function useVoiceAssistant(opts: {
  apiKey: string | undefined
  model: string | undefined
}): VoiceAssistantApi {
  const { apiKey, model } = opts
  const { announcePolite, announceAssertive } = useAccessibilityAnnouncements()
  const { vibrate } = useHaptics()
  const { settings } = useSettings()

  const [status, setStatus] = useState<AssistantState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [micMuted, setMicMuted] = useState(false)
  const [userTurns, setUserTurns] = useState<TranscriptTurn[]>([])
  const [assistantTurns, setAssistantTurns] = useState<TranscriptTurn[]>([])
  const [userDraft, setUserDraft] = useState("")
  const [assistantDraft, setAssistantDraft] = useState("")
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([])
  const [helpOpen, setHelpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)
  const [hasLastResponse, setHasLastResponse] = useState(false)

  const support = useMemo(() => detectAudioSupport(), [])
  const unsupportedReason = support.ok ? null : (support.reason ?? null)

  const clientRef = useRef<GeminiLiveClient | null>(null)
  const micRef = useRef<MicRecorder | null>(null)
  const playerRef = useRef<AudioPlayer | null>(null)
  const statusRef = useRef<AssistantState>("idle")
  const userDraftRef = useRef("")
  const assistantDraftRef = useRef("")
  const turnHadAudioRef = useRef(false)
  const hadAudioGenerationRef = useRef(false)
  // Timer used to flip to "processing" shortly after the user transcript
  // stream goes quiet — gives the UI immediate movement instead of dwelling
  // on "Listening" until the first assistant audio chunk arrives.
  const processingTimerRef = useRef<number | null>(null)

  const setStatusSafe = useCallback(
    (next: AssistantState) => {
      if (statusRef.current === next) return
      statusRef.current = next
      setStatus(next)
      const msg = STATE_ANNOUNCEMENTS[next]
      if (msg) announcePolite(msg)
    },
    [announcePolite]
  )

  const pushDebug = useCallback((event: string, data?: unknown) => {
    setDebugEvents((prev) => {
      const next = [...prev, { at: Date.now(), event, data }]
      if (next.length > DEBUG_RING_SIZE)
        next.splice(0, next.length - DEBUG_RING_SIZE)
      return next
    })
  }, [])

  const clearProcessingTimer = useCallback(() => {
    if (processingTimerRef.current !== null) {
      window.clearTimeout(processingTimerRef.current)
      processingTimerRef.current = null
    }
  }, [])

  const teardown = useCallback(async () => {
    clearProcessingTimer()
    if (clientRef.current) {
      clientRef.current.close()
      clientRef.current = null
    }
    if (micRef.current) {
      await micRef.current.stop()
      micRef.current = null
    }
    if (playerRef.current) {
      await playerRef.current.stop()
      playerRef.current = null
    }
  }, [clearProcessingTimer])

  // Initial state on mount: if unsupported, lock there. Otherwise jump to ready
  // (which is more meaningful than `idle` as a brief readiness signal).
  useEffect(() => {
    if (!support.ok) {
      setStatusSafe("unsupported")
      if (support.reason) announceAssertive(support.reason)
      return
    }
    setStatusSafe("ready")
  }, [announceAssertive, setStatusSafe, support])

  const endSession = useCallback(async () => {
    pushDebug("session:end")
    setStatusSafe("stopping")
    vibrate("listeningStop")
    await teardown()
    setMicMuted(false)
    setHasLastResponse(false)
    setStatusSafe("closed")
  }, [pushDebug, setStatusSafe, teardown, vibrate])

  const stopSpeaking = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    player.flush()
    pushDebug("session:stop-speaking")
    if (statusRef.current === "speaking") {
      setStatusSafe("listening")
    }
  }, [pushDebug, setStatusSafe])

  const repeatLastResponse = useCallback(() => {
    const player = playerRef.current
    if (!player) {
      announcePolite("No response to repeat yet.")
      return
    }
    const ok = player.replayLastTurn()
    if (ok) {
      announcePolite("Repeating the last response.")
      pushDebug("session:repeat")
      if (statusRef.current === "listening") setStatusSafe("speaking")
    } else {
      announcePolite("No response to repeat yet.")
    }
  }, [announcePolite, pushDebug, setStatusSafe])

  const reset = useCallback(() => {
    setUserTurns([])
    setAssistantTurns([])
    setUserDraft("")
    setAssistantDraft("")
    userDraftRef.current = ""
    assistantDraftRef.current = ""
    setDebugEvents([])
    setError(null)
    if (
      statusRef.current === "closed" ||
      statusRef.current === "error"
    ) {
      setStatusSafe(support.ok ? "ready" : "unsupported")
    }
  }, [setStatusSafe, support.ok])

  const getAnalyser = useCallback(
    () => playerRef.current?.getAnalyser() ?? null,
    []
  )

  const openHelp = useCallback(() => setHelpOpen(true), [])
  const closeHelp = useCallback(() => setHelpOpen(false), [])
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const openDebug = useCallback(() => setDebugOpen(true), [])
  const closeDebug = useCallback(() => setDebugOpen(false), [])

  // Apply playback rate when settings change (or on mount).
  useEffect(() => {
    playerRef.current?.setPlaybackRate(SPEED_RATE[settings.speechSpeed])
  }, [settings.speechSpeed])

  const handleVoiceCommand = useCallback(
    (intent: Intent) => {
      pushDebug("voice-command", intent.type)
      switch (intent.type) {
        case "stop":
        case "cancel":
          stopSpeaking()
          break
        case "repeat":
          repeatLastResponse()
          break
        case "help":
        case "whatCanISay":
          setHelpOpen(true)
          break
        case "speakSlower":
        case "speakFaster":
          // Settings panel is the source of truth; we don't mutate it from
          // here to avoid surprise persistence. Tell the user what to do.
          announcePolite(
            "Open settings to change speech speed. Press the settings button or say 'help'."
          )
          break
      }
    },
    [announcePolite, pushDebug, repeatLastResponse, stopSpeaking]
  )

  const start = useCallback(async () => {
    if (!support.ok) {
      announceAssertive(support.reason ?? "Voice is not supported here.")
      return
    }
    if (!apiKey) {
      const msg =
        "Missing Gemini API key. Set VITE_GEMINI_API_KEY in .env.local and restart the dev server."
      setError(msg)
      setStatusSafe("error")
      announceAssertive(msg)
      return
    }
    const s = statusRef.current
    if (
      s === "requesting-mic" ||
      s === "connecting" ||
      s === "listening" ||
      s === "speaking" ||
      s === "processing"
    ) {
      return
    }

    setError(null)
    setUserDraft("")
    setAssistantDraft("")
    userDraftRef.current = ""
    assistantDraftRef.current = ""
    hadAudioGenerationRef.current = false
    setStatusSafe("requesting-mic")
    pushDebug("session:start")

    const player = new AudioPlayer()
    player.setPlaybackRate(SPEED_RATE[settings.speechSpeed])
    player.setOnPlaybackEnd(() => {
      // Once the queued audio actually finishes (or was flushed), leave the
      // "speaking" state. turnComplete arrives well before playback ends
      // because chunks are scheduled into the future.
      if (statusRef.current === "speaking") {
        setStatusSafe("listening")
      }
    })
    playerRef.current = player

    const mic = new MicRecorder()
    micRef.current = mic

    const client = new GeminiLiveClient({
      apiKey,
      model,
      events: {
        onOpen: () => {
          pushDebug("client:open")
          setStatusSafe("listening")
          vibrate("listeningStart")
        },
        onClose: (reason) => {
          pushDebug("client:close", reason)
          if (statusRef.current !== "error") setStatusSafe("closed")
          void teardown()
        },
        onError: (err) => {
          pushDebug("client:error", err.message)
          const friendly =
            "I could not connect to the assistant. Check your connection and press start to retry."
          setError(friendly)
          announceAssertive(friendly)
          setStatusSafe("error")
          vibrate("error")
          void teardown()
        },
        onAudioChunk: (chunk) => {
          clearProcessingTimer()
          if (!turnHadAudioRef.current) {
            playerRef.current?.startTurn()
            turnHadAudioRef.current = true
            hadAudioGenerationRef.current = true
          }
          if (
            statusRef.current === "listening" ||
            statusRef.current === "processing"
          ) {
            setStatusSafe("speaking")
          }
          playerRef.current?.enqueue(chunk)
        },
        onInterrupted: () => {
          pushDebug("client:interrupted")
          clearProcessingTimer()
          playerRef.current?.flush()
          turnHadAudioRef.current = false
          if (statusRef.current === "speaking") setStatusSafe("listening")
        },
        onTurnComplete: () => {
          pushDebug("client:turn-complete")
          clearProcessingTimer()
          if (turnHadAudioRef.current) {
            playerRef.current?.endTurn()
            turnHadAudioRef.current = false
            setHasLastResponse(true)
          }
          // Commit drafts as turns.
          if (userDraftRef.current.trim()) {
            const text = userDraftRef.current.trim()
            setUserTurns((prev) => [...prev, { role: "user", text }])
            const intent = parseCommand(text)
            if (intent) handleVoiceCommand(intent)
          }
          if (assistantDraftRef.current.trim()) {
            const text = assistantDraftRef.current.trim()
            setAssistantTurns((prev) => [
              ...prev,
              { role: "assistant", text },
            ])
          }
          userDraftRef.current = ""
          assistantDraftRef.current = ""
          setUserDraft("")
          setAssistantDraft("")
          // Leaving "speaking" is handled by onPlaybackEnd from the player —
          // turnComplete fires earlier than the audio actually finishes.
          if (
            !playerRef.current?.isPlaying() &&
            statusRef.current === "speaking"
          ) {
            // No audio enqueued for this turn; safe to flip immediately.
            setStatusSafe("listening")
          }
          if (hadAudioGenerationRef.current) {
            vibrate("success")
            hadAudioGenerationRef.current = false
          }
        },
        onUserTranscript: (text, isFinal) => {
          if (isFinal) return
          userDraftRef.current += text
          setUserDraft(userDraftRef.current)
          // Each new transcript fragment resets a short timer; if no more
          // fragments arrive within the window the user has likely stopped,
          // so we move to "processing" right away rather than waiting for
          // the model's first audio chunk to land.
          clearProcessingTimer()
          processingTimerRef.current = window.setTimeout(() => {
            processingTimerRef.current = null
            if (statusRef.current === "listening") {
              setStatusSafe("processing")
            }
          }, 250)
        },
        onAssistantTranscript: (text, isFinal) => {
          if (isFinal) return
          assistantDraftRef.current += text
          setAssistantDraft(assistantDraftRef.current)
          if (
            statusRef.current === "listening" &&
            !turnHadAudioRef.current
          ) {
            setStatusSafe("processing")
          }
        },
        onDebug: pushDebug,
      },
    })
    clientRef.current = client

    try {
      await mic.start((chunk) => client.sendAudioChunk(chunk))
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      pushDebug("mic:error", raw)
      const denied =
        raw.includes("Permission") ||
        raw.includes("denied") ||
        raw.includes("NotAllowed")
      const friendly = denied
        ? "I could not access the microphone. Please grant permission in your browser settings and try again."
        : `Microphone error: ${raw}`
      setError(friendly)
      announceAssertive(friendly)
      setStatusSafe(denied ? "permission-required" : "error")
      vibrate("error")
      await teardown()
      return
    }

    setStatusSafe("connecting")
    try {
      await client.connect()
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      pushDebug("connect:error", raw)
      const friendly =
        "I could not connect to the assistant. Check your connection and press start to retry."
      setError(friendly)
      announceAssertive(friendly)
      setStatusSafe("error")
      vibrate("error")
      await teardown()
    }
  }, [
    apiKey,
    model,
    pushDebug,
    setStatusSafe,
    teardown,
    settings.speechSpeed,
    support,
    announceAssertive,
    vibrate,
    handleVoiceCommand,
    clearProcessingTimer,
  ])

  const toggleMute = useCallback(() => {
    setMicMuted((prev) => {
      const next = !prev
      micRef.current?.setMuted(next)
      pushDebug("mic:mute", next)
      announcePolite(next ? "Microphone muted." : "Microphone on.")
      return next
    })
  }, [announcePolite, pushDebug])

  useEffect(() => {
    return () => {
      void teardown()
    }
  }, [teardown])

  return {
    status,
    error,
    micMuted,
    isSupported: support.ok,
    unsupportedReason,
    hasLastResponse,
    userTurns,
    assistantTurns,
    userDraft,
    assistantDraft,
    debugEvents,
    start,
    endSession,
    stopSpeaking,
    repeatLastResponse,
    toggleMute,
    reset,
    openHelp,
    closeHelp,
    helpOpen,
    openSettings,
    closeSettings,
    settingsOpen,
    openDebug,
    closeDebug,
    debugOpen,
    getAnalyser,
  }
}
