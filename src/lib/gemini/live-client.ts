import {
  EndSensitivity,
  GoogleGenAI,
  Modality,
  StartSensitivity,
  type LiveServerMessage,
  type Session,
} from "@google/genai"

import { base64Decode, base64Encode } from "@/lib/audio/pcm16"
import {
  buildSystemInstruction,
  DEFAULT_MODEL,
  type InitialLocation,
} from "./gemini-config"

export type GeminiLiveEvents = {
  onOpen?: () => void
  onClose?: (reason?: string) => void
  onError?: (error: Error) => void
  onAudioChunk?: (pcm16: ArrayBuffer) => void
  onUserTranscript?: (text: string, isFinal: boolean) => void
  onAssistantTranscript?: (text: string, isFinal: boolean) => void
  onInterrupted?: () => void
  onTurnComplete?: () => void
  onDebug?: (event: string, data?: unknown) => void
}

export type GeminiLiveOptions = {
  apiKey: string
  model?: string
  events: GeminiLiveEvents
}

export class GeminiLiveClient {
  private readonly apiKey: string
  private readonly model: string
  private readonly events: GeminiLiveEvents
  private session: Session | null = null
  private closed = false

  constructor(opts: GeminiLiveOptions) {
    this.apiKey = opts.apiKey
    this.model = opts.model ?? DEFAULT_MODEL
    this.events = opts.events
  }

  async connect(initialLocation: InitialLocation = null): Promise<void> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey })
    const systemInstruction = buildSystemInstruction(initialLocation)
    this.events.onDebug?.("prompt:built", {
      hasLocation: initialLocation?.ok === true,
      chars: systemInstruction.length,
    })

    this.session = await ai.live.connect({
      model: this.model,
      callbacks: {
        onopen: () => {
          this.events.onDebug?.("ws:open")
          this.events.onOpen?.()
        },
        onmessage: (message) => this.handleMessage(message),
        onerror: (e: ErrorEvent) => {
          const err = new Error(e.message || "Gemini Live socket error")
          this.events.onDebug?.("ws:error", { message: e.message })
          this.events.onError?.(err)
        },
        onclose: (e: CloseEvent) => {
          this.events.onDebug?.("ws:close", {
            code: e.code,
            reason: e.reason,
          })
          this.events.onClose?.(e.reason)
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},

        realtimeInputConfig: {
          automaticActivityDetection: {
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
            silenceDurationMs: 100,
            prefixPaddingMs: 50,
          },
        },
      },
    })
  }

  sendAudioChunk(pcm16: ArrayBuffer): void {
    if (!this.session || this.closed) return
    const base64 = base64Encode(pcm16)
    this.session.sendRealtimeInput({
      audio: { data: base64, mimeType: "audio/pcm;rate=16000" },
    })
  }

  // model can answer "nearest me" questions without needing
  sendContextTurn(text: string): void {
    if (!this.session || this.closed) return
    this.session.sendClientContent({
      turns: [{ role: "user", parts: [{ text }] }],
      turnComplete: false,
    })
    this.events.onDebug?.("ctx:inject", { chars: text.length })
  }

  close(): void {
    this.closed = true
    if (this.session) {
      try {
        this.session.close()
      } catch {
        // ignore
      }
      this.session = null
    }
  }

  private handleMessage(message: LiveServerMessage): void {
    const sc = message.serverContent
    if (!sc) {
      if (message.setupComplete) this.events.onDebug?.("setup:complete")
      return
    }

    if (sc.interrupted) {
      this.events.onDebug?.("turn:interrupted")
      this.events.onInterrupted?.()
    }

    const inputT = sc.inputTranscription?.text
    if (inputT) {
      this.events.onUserTranscript?.(inputT, false)
    }

    const outputT = sc.outputTranscription?.text
    if (outputT) {
      this.events.onAssistantTranscript?.(outputT, false)
    }

    const parts = sc.modelTurn?.parts
    if (parts) {
      for (const part of parts) {
        const inline = part.inlineData
        if (inline?.data) {
          const buf = base64Decode(inline.data)
          this.events.onAudioChunk?.(buf)
        }
      }
    }

    if (sc.turnComplete) {
      this.events.onDebug?.("turn:complete")
      this.events.onAssistantTranscript?.("", true)
      this.events.onUserTranscript?.("", true)
      this.events.onTurnComplete?.()
    }
  }
}
