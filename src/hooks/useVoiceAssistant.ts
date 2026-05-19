import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { VENUES } from "@/data/maptivate"
import { AudioPlayer } from "@/lib/audio/audio-player"
import { MicRecorder } from "@/lib/audio/mic-recorder"
import { detectAudioSupport } from "@/lib/audio/support"
import { approximateLga, nearestVenues } from "@/lib/geo"
import { GeminiLiveClient } from "@/lib/gemini/live-client"
import { parse as parseCommand, type Intent } from "@/services/commandParser"
import type {
  AssistantState,
  DebugEvent,
  TranscriptTurn,
} from "@/types/assistant"

import { useAccessibilityAnnouncements } from "./useAccessibilityAnnouncements"
import { useGeolocation } from "./useGeolocation"
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
  "requesting-location": "Checking your location.",
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
  const geolocation = useGeolocation()

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
  // Continuously updated from navigator.geolocation.watchPosition while the
  // session is active. We inject the freshest value into every user turn so
  // the model always has the user's coords in context — no waiting on a
  // permission prompt mid-conversation, and the position stays fresh as the
  // user walks. null = no fix yet for this session.
  const userLocationRef = useRef<
    | { ok: true; lat: number; lng: number; accuracyM: number }
    | { ok: false; error: string }
    | null
  >(null)
  const stopWatchRef = useRef<(() => void) | null>(null)
  // Ensures the location-context turn is injected exactly once per user
  // turn — on the first transcript fragment we see, so the model has fresh
  // coords in context BEFORE it starts generating its reply.
  const locationInjectedThisTurnRef = useRef(false)
  // Same idea for the "nearest me" pre-ranked top-5 list.
  const nearMeInjectedThisTurnRef = useRef(false)
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
    userLocationRef.current = null
    if (stopWatchRef.current) {
      stopWatchRef.current()
      stopWatchRef.current = null
    }
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

  // Inject a small "[Client context] You are at lat, lng (approximate area:
  // ...)" turn at the start of every user turn. Cheap, runs locally, gives
  // the model the location it would otherwise refuse to use.
  const injectLocationContext = useCallback(() => {
    const client = clientRef.current
    if (!client) return
    const loc = userLocationRef.current
    let body: string
    if (loc?.ok) {
      const lga = approximateLga({ lat: loc.lat, lng: loc.lng }, VENUES)
      const accNote =
        loc.accuracyM > 5000
          ? ` (fix is approximate; accuracy radius ${Math.round(loc.accuracyM / 1000)} km)`
          : ""
      body = `[Client context] The user's current location is latitude ${loc.lat.toFixed(
        5
      )}, longitude ${loc.lng.toFixed(5)}${accNote}. Approximate area based on dataset: ${
        lga ?? "unknown"
      }. Treat this as the user's "current location" / "near me" reference for this turn. You DO have this location.`
    } else if (loc && !loc.ok) {
      body = `[Client context] The user's location is unavailable for this session (reason: ${loc.error}). If they ask about "nearest" or "near me", ask which suburb they're near.`
    } else {
      // No fix yet — the watchPosition subscription hasn't called back.
      body = `[Client context] The user's location is not yet available (still resolving). If they ask about "nearest" or "near me" this turn, briefly ask them to wait a moment or to name a suburb.`
    }
    client.sendContextTurn(body)
  }, [])

  // Called when the user's utterance matches the "nearest me" intent. The
  // basic coords have already been injected via injectLocationContext on the
  // first transcript fragment of this turn; here we add the pre-ranked
  // top-5 list so the model can answer with named venues + distances.
  const handleNearMe = useCallback(() => {
    const client = clientRef.current
    const loc = userLocationRef.current
    if (!client || !loc?.ok) return
    const top = nearestVenues({ lat: loc.lat, lng: loc.lng }, VENUES, 5)
    const lines = top.map((v, i) => {
      const km = v.distanceKm.toFixed(1)
      const access = v.access.length
        ? v.access.slice(0, 3).join("; ")
        : "no listed access features"
      const note = v.accessibilityNotes
        ? ` Notes: ${v.accessibilityNotes}`
        : ""
      return `${i + 1}. ${v.title} (${v.lga}) — ${km} km away. Access: ${access}.${note}`
    })
    pushDebug("geo:nearest-injected", { count: top.length })
    client.sendContextTurn(
      `[Client context] Pre-ranked nearest venues for the user's current location:\n${lines.join(
        "\n"
      )}\nUse this list to answer. Lead with the closest one or two by name and a short accessibility highlight; offer more on request.`
    )
  }, [pushDebug])

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
        case "nearMe":
          void handleNearMe()
          break
      }
    },
    [announcePolite, handleNearMe, pushDebug, repeatLastResponse, stopSpeaking]
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
    userLocationRef.current = null
    setStatusSafe("requesting-mic")
    pushDebug("session:start")

    // Subscribe to continuous geolocation updates for the session. The first
    // callback typically arrives in a few seconds. We don't block on it —
    // every user turn will pick up whatever the latest cached fix is. As the
    // user walks, the ref stays fresh so the model always has current coords.
    pushDebug("geo:watch:start")
    stopWatchRef.current = geolocation.watch((result) => {
      const prev = userLocationRef.current
      userLocationRef.current = result
      if (result.ok) {
        // Only log the first fix and meaningful updates to keep the debug
        // ring useful (watchPosition can fire frequently).
        const movedFar =
          !prev ||
          !prev.ok ||
          Math.abs(prev.lat - result.lat) > 0.0001 ||
          Math.abs(prev.lng - result.lng) > 0.0001
        if (movedFar) {
          pushDebug("geo:update", {
            lat: result.lat,
            lng: result.lng,
            accuracyM: Math.round(result.accuracyM),
          })
        }
      } else {
        pushDebug("geo:failed", result.error)
      }
    })

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
          // Allow the next user turn to inject a fresh location context.
          locationInjectedThisTurnRef.current = false
          nearMeInjectedThisTurnRef.current = false
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
          // First transcript fragment of this turn → inject location context
          // BEFORE the model finishes thinking. sendClientContent is ordered,
          // so this lands in the conversation ahead of the assistant's reply.
          if (!locationInjectedThisTurnRef.current) {
            locationInjectedThisTurnRef.current = true
            injectLocationContext()
          }
          userDraftRef.current += text
          setUserDraft(userDraftRef.current)
          // If we can already see a "nearest me" phrase in the running
          // draft, also inject the pre-ranked list while the model is still
          // hearing the user. Idempotency is handled by the locationInjected
          // flag above — handleNearMe itself can be called more than once
          // safely as long as we don't spam every fragment; we gate on a
          // dedicated flag stored on the ref's identity.
          const draftLower = userDraftRef.current.toLowerCase()
          if (
            !nearMeInjectedThisTurnRef.current &&
            /\b(near(?:est)?\s+(?:me|here|by|to\s+me)|closest(?:\s+to\s+me)?|around\s+(?:me|here))\b/.test(
              draftLower
            )
          ) {
            nearMeInjectedThisTurnRef.current = true
            handleNearMe()
          }
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

    // Pre-flight: try to get one synchronous location fix before we open the
    // Live session, so the systemInstruction we send to Gemini already
    // contains the user's coords. We race against a short timeout — if the
    // browser hasn't answered in 4s, we connect without coords; the watcher
    // (started above in start) will populate userLocationRef later and the
    // per-turn [Client context] injection will fill in the gap.
    const preflight = await Promise.race<
      typeof userLocationRef.current | "timeout"
    >([
      // If the watcher already produced a fix while mic was warming up, use it.
      userLocationRef.current
        ? Promise.resolve(userLocationRef.current)
        : geolocation.request(),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 4000)),
    ])
    const initialLocation =
      preflight && preflight !== "timeout" ? preflight : null
    if (initialLocation) {
      userLocationRef.current = initialLocation
      pushDebug(
        initialLocation.ok ? "geo:preflight:ok" : "geo:preflight:failed",
        initialLocation.ok
          ? {
              lat: initialLocation.lat,
              lng: initialLocation.lng,
              accuracyM: Math.round(initialLocation.accuracyM),
            }
          : initialLocation.error
      )
    } else {
      pushDebug("geo:preflight:timeout")
    }

    try {
      await client.connect(initialLocation)
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
    geolocation,
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
