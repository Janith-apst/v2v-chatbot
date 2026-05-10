import { useCallback, useEffect, useState } from "react"

export type SpeechSpeed = "slow" | "normal" | "fast"
export type Verbosity = "short" | "detailed"

export type Settings = {
  speechSpeed: SpeechSpeed
  verbosity: Verbosity
  vibration: boolean
  autoSpeak: boolean
}

const STORAGE_KEY = "voice-poc.settings"

const DEFAULT_SETTINGS: Settings = {
  speechSpeed: "normal",
  verbosity: "short",
  vibration: true,
  autoSpeak: true,
}

const CHANGE_EVENT = "voice-poc:settings-changed"

function readFromStorage(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function writeToStorage(settings: Settings) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // ignore quota / private mode
  }
}

export function useSettings(): {
  settings: Settings
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  resetSettings: () => void
} {
  const [settings, setSettingsState] = useState<Settings>(readFromStorage)

  // Sync across hook instances and across browser tabs.
  useEffect(() => {
    const onChange = () => setSettingsState(readFromStorage())
    window.addEventListener(CHANGE_EVENT, onChange)
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) onChange()
    })
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [])

  const setSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettingsState((prev) => {
        const next = { ...prev, [key]: value }
        writeToStorage(next)
        window.dispatchEvent(new Event(CHANGE_EVENT))
        return next
      })
    },
    []
  )

  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS)
    writeToStorage(DEFAULT_SETTINGS)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return { settings, setSetting, resetSettings }
}
