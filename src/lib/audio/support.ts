export type AudioSupport = {
  ok: boolean
  audioContext: boolean
  audioWorklet: boolean
  getUserMedia: boolean
  // Human-readable reason when ok is false. Suitable for direct user display.
  reason?: string
}

export function detectAudioSupport(): AudioSupport {
  if (typeof window === "undefined") {
    return {
      ok: false,
      audioContext: false,
      audioWorklet: false,
      getUserMedia: false,
      reason: "Audio is not available in this environment.",
    }
  }

  const audioContext =
    typeof window.AudioContext !== "undefined" ||
    typeof (window as unknown as { webkitAudioContext?: unknown })
      .webkitAudioContext !== "undefined"
  const audioWorklet =
    audioContext && typeof window.AudioWorkletNode !== "undefined"
  const getUserMedia = !!(
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia
  )

  if (!getUserMedia) {
    return {
      ok: false,
      audioContext,
      audioWorklet,
      getUserMedia,
      reason:
        "Microphone access is unavailable on this device or browser. Try the latest Chrome, Edge, or Safari over HTTPS or on localhost.",
    }
  }
  if (!audioContext) {
    return {
      ok: false,
      audioContext,
      audioWorklet,
      getUserMedia,
      reason:
        "This browser does not support the Web Audio API needed for voice. Try the latest Chrome, Edge, or Safari.",
    }
  }
  if (!audioWorklet) {
    return {
      ok: false,
      audioContext,
      audioWorklet,
      getUserMedia,
      reason:
        "This browser is missing AudioWorklet support, which is required for low-latency voice. Try the latest Chrome, Edge, or Safari.",
    }
  }

  return { ok: true, audioContext, audioWorklet, getUserMedia }
}
