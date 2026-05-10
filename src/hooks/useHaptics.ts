import { useCallback } from "react"
import { useWebHaptics } from "web-haptics/react"

import { useSettings } from "./useSettings"

export type HapticEvent =
  | "ready"
  | "listeningStart"
  | "listeningStop"
  | "processing"
  | "success"
  | "error"
  | "confirm"

// Map our semantic events to web-haptics presets.
const PRESET: Record<HapticEvent, string> = {
  ready: "light",
  listeningStart: "medium",
  listeningStop: "light",
  processing: "selection",
  success: "success",
  error: "error",
  confirm: "success",
}

export function useHaptics(): {
  supported: boolean
  vibrate: (event: HapticEvent) => void
} {
  const { settings } = useSettings()
  const { trigger, isSupported } = useWebHaptics()

  const vibrate = useCallback(
    (event: HapticEvent) => {
      if (!settings.vibration) return
      // No-ops cleanly when unsupported. We ignore the returned promise; haptic
      // failure should never block the caller.
      void trigger(PRESET[event])
    },
    [settings.vibration, trigger]
  )

  return { supported: isSupported, vibrate }
}
