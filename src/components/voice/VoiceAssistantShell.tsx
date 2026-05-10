import { useEffect, useRef } from "react"

import { useAccessibilityAnnouncements } from "@/hooks/useAccessibilityAnnouncements"
import { useHaptics } from "@/hooks/useHaptics"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { useThemeColorMeta } from "@/hooks/useThemeColorMeta"
import { useTouchGestures } from "@/hooks/useTouchGestures"
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant"

import { HeaderActions } from "./HeaderActions"
import { TalkArea } from "./TalkArea"
import { TranscriptPanel } from "./TranscriptPanel"
import { VoiceDebugDrawer } from "./VoiceDebugDrawer"
import { VoiceHelpDialog } from "./VoiceHelpDialog"
import { VoiceSettingsPanel } from "./VoiceSettingsPanel"

const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
const model = import.meta.env.VITE_GEMINI_MODEL as string | undefined
const DEBUG_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_DEBUG === "1"

export function VoiceAssistantShell() {
  const assistant = useVoiceAssistant({ apiKey, model })
  const { announcePolite } = useAccessibilityAnnouncements()
  const haptics = useHaptics()
  const talkRef = useRef<HTMLButtonElement>(null)
  const gestureZoneRef = useRef<HTMLDivElement>(null)
  useThemeColorMeta()

  useEffect(() => {
    talkRef.current?.focus()
  }, [])

  const isActive =
    assistant.status === "listening" ||
    assistant.status === "speaking" ||
    assistant.status === "processing" ||
    assistant.status === "connecting"

  const handlePrimary = () => {
    // Fire haptic synchronously inside the user gesture so iOS Safari and
    // Android Chrome both honour it (some browsers reject vibrate() outside
    // a user-activation context).
    haptics.vibrate(isActive ? "listeningStop" : "listeningStart")
    if (isActive) void assistant.endSession()
    else void assistant.start()
  }

  useKeyboardShortcuts({
    Escape: () => {
      if (assistant.status === "speaking") {
        haptics.vibrate("listeningStop")
        assistant.stopSpeaking()
        return
      }
      if (isActive) {
        haptics.vibrate("listeningStop")
        void assistant.endSession()
      }
    },
    r: () => {
      if (assistant.hasLastResponse) {
        haptics.vibrate("ready")
        assistant.repeatLastResponse()
      } else announcePolite("No response to repeat yet.")
    },
    "?": () => assistant.openHelp(),
    "/": (e) => {
      if (e.shiftKey) assistant.openHelp()
    },
  })

  useTouchGestures(gestureZoneRef, {
    onTap: handlePrimary,
    onSwipeDown: () => {
      if (assistant.status === "speaking") {
        haptics.vibrate("listeningStop")
        assistant.stopSpeaking()
        announcePolite("Speech stopped.")
      }
    },
    onSwipeUp: () => {
      if (assistant.hasLastResponse) {
        haptics.vibrate("ready")
        assistant.repeatLastResponse()
      } else {
        announcePolite("No response to repeat yet.")
      }
    },
    onTwoFingerTap: () => {
      haptics.vibrate("ready")
      assistant.openHelp()
    },
  })

  return (
    <div
      className="flex h-full min-h-svh flex-col"
      style={{
        // Respect notch / status bar / home indicator on iOS.
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <h1 id="app-title" className="sr-only">
          Voice Assistant
        </h1>
        <span className="text-sm font-medium text-muted-foreground">
          Voice Assistant
        </span>
        <HeaderActions
          onOpenHelp={assistant.openHelp}
          onOpenSettings={assistant.openSettings}
          onOpenDebug={DEBUG_ENABLED ? assistant.openDebug : undefined}
        />
      </header>

      {!apiKey && (
        <div
          role="alert"
          className="mx-4 mb-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <strong className="font-medium">API key missing.</strong> Set{" "}
          <code>VITE_GEMINI_API_KEY</code> in <code>.env.local</code> and
          restart the dev server.
        </div>
      )}

      <main
        aria-labelledby="app-title"
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col"
      >
        <div
          ref={gestureZoneRef}
          className="gesture-zone flex flex-1 items-center justify-center px-4"
        >
          <TalkArea
            ref={talkRef}
            status={assistant.status}
            onActivate={handlePrimary}
            getAnalyser={assistant.getAnalyser}
          />
        </div>

        <div className="px-4 pb-4">
          <TranscriptPanel
            userTurns={assistant.userTurns}
            assistantTurns={assistant.assistantTurns}
            userDraft={assistant.userDraft}
            assistantDraft={assistant.assistantDraft}
          />
        </div>
      </main>

      <VoiceHelpDialog
        open={assistant.helpOpen}
        onClose={assistant.closeHelp}
      />
      <VoiceSettingsPanel
        open={assistant.settingsOpen}
        onClose={assistant.closeSettings}
      />
      {DEBUG_ENABLED && (
        <VoiceDebugDrawer
          open={assistant.debugOpen}
          onClose={assistant.closeDebug}
          events={assistant.debugEvents}
        />
      )}
    </div>
  )
}
