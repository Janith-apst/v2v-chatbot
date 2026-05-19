import { forwardRef } from "react"

import { cn } from "@/lib/utils"
import type { AssistantState } from "@/types/assistant"

import { VoiceVisualizer } from "./VoiceVisualizer"

const ACTIVE_STATES: AssistantState[] = [
  "requesting-mic",
  "connecting",
  "listening",
  "processing",
  "speaking",
  "stopping",
  "requesting-location",
]

const LABEL: Record<AssistantState, string> = {
  idle: "Tap to talk",
  ready: "Tap to talk",
  "requesting-mic": "Requesting microphone permission",
  "permission-required": "Microphone permission needed",
  connecting: "Connecting",
  listening: "Listening",
  processing: "Thinking",
  speaking: "Speaking",
  stopping: "Stopping",
  "requesting-location": "Checking your location",
  error: "Tap to try again",
  unsupported: "Voice unavailable",
  closed: "Tap to talk",
}

type Props = {
  status: AssistantState
  onActivate: () => void
  getAnalyser: () => AnalyserNode | null
}

export const TalkArea = forwardRef<HTMLButtonElement, Props>(
  function TalkArea({ status, onActivate, getAnalyser }, ref) {
    const isUnsupported = status === "unsupported"
    const label = LABEL[status]
    const isActive = ACTIVE_STATES.includes(status)

    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-keyshortcuts="Space"
        aria-disabled={isUnsupported}
        onClick={() => {
          if (!isUnsupported) onActivate()
        }}
        className={cn(
          "talk-area flex w-full flex-1 flex-col items-center justify-center gap-6 rounded-3xl bg-transparent",
          isActive ? "text-destructive" : "text-primary"
        )}
      >
        <VoiceVisualizer status={status} getAnalyser={getAnalyser} />
        <span
          className={cn(
            "text-center text-2xl font-medium tracking-tight sm:text-3xl",
            isActive ? "text-foreground" : "text-foreground"
          )}
        >
          {label}
        </span>
      </button>
    )
  }
)
