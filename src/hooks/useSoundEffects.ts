import { useCallback } from "react"

import type { HapticEvent } from "./useHaptics"
import { useSettings } from "./useSettings"

// Module-scoped: one AudioContext shared across the lifetime of the page so
// SFX can fire before any session is open (e.g. taps, errors after teardown)
// and don't compete with AudioPlayer's session-scoped 24 kHz context.
let ctx: AudioContext | null = null
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (typeof window.AudioContext === "undefined") return null
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

type ToneSpec = {
  // Frequency in Hz at time 0. If `to` is set, glides linearly to that value.
  freq: number
  to?: number
  // Total tone duration in seconds.
  durationS: number
  // Peak amplitude (0..1). Kept low so the SFX layer doesn't fight TTS.
  peak: number
  // Oscillator wave shape.
  type?: OscillatorType
}

function playTone(c: AudioContext, spec: ToneSpec, startOffsetS = 0): void {
  const now = c.currentTime + startOffsetS
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = spec.type ?? "sine"
  osc.frequency.setValueAtTime(spec.freq, now)
  if (spec.to !== undefined) {
    osc.frequency.linearRampToValueAtTime(spec.to, now + spec.durationS)
  }
  // ADSR-ish envelope. Short attack avoids click; exponential release avoids
  // a hard cutoff click at the end.
  const attack = Math.min(0.012, spec.durationS / 4)
  const release = Math.max(0.01, spec.durationS / 3)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(spec.peak, now + attack)
  gain.gain.setValueAtTime(spec.peak, now + spec.durationS - release)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.durationS)
  osc.connect(gain).connect(c.destination)
  osc.start(now)
  osc.stop(now + spec.durationS + 0.02)
}

// Tone palette — see the plan for the rationale on each. Kept volumes low
// (peak <= 0.15) so SFX sit under the assistant's voice rather than over it.
function playEvent(c: AudioContext, event: HapticEvent): void {
  switch (event) {
    case "ready":
      playTone(c, { freq: 660, durationS: 0.06, peak: 0.1, type: "sine" })
      return
    case "listeningStart":
      playTone(c, {
        freq: 880,
        to: 1320,
        durationS: 0.12,
        peak: 0.12,
        type: "sine",
      })
      return
    case "listeningStop":
      playTone(c, {
        freq: 1320,
        to: 880,
        durationS: 0.12,
        peak: 0.12,
        type: "sine",
      })
      return
    case "processing":
      playTone(c, { freq: 440, durationS: 0.04, peak: 0.08, type: "sine" })
      return
    case "success":
    case "confirm":
      // Two-note "done" — second note overlaps the tail of the first.
      playTone(c, { freq: 660, durationS: 0.09, peak: 0.12, type: "sine" })
      playTone(
        c,
        { freq: 988, durationS: 0.11, peak: 0.12, type: "sine" },
        0.07
      )
      return
    case "error":
      playTone(c, { freq: 220, durationS: 0.18, peak: 0.14, type: "square" })
      return
  }
}

export function useSoundEffects(): {
  supported: boolean
  play: (event: HapticEvent) => void
} {
  const { settings } = useSettings()
  const supported =
    typeof window !== "undefined" && typeof window.AudioContext !== "undefined"

  const play = useCallback(
    (event: HapticEvent) => {
      if (!settings.soundEffects) return
      const c = getCtx()
      if (!c) return
      try {
        playEvent(c, event)
      } catch {
        // Web Audio can throw if the context closes unexpectedly; SFX
        // failure must never break the caller.
      }
    },
    [settings.soundEffects]
  )

  return { supported, play }
}
