/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

export type AnnouncementPriority = "polite" | "assertive"

export type LiveAnnouncerContextValue = {
  announce: (message: string, priority?: AnnouncementPriority) => void
}

const LiveAnnouncerContext = React.createContext<
  LiveAnnouncerContextValue | undefined
>(undefined)

// 250 ms debounce per channel — collapses rapid state churn into a single
// announcement while still feeling responsive.
const DEBOUNCE_MS = 250

type ChannelState = {
  text: string
  // Toggled each time we replace the text so a re-announcement of the same
  // string still triggers the live region.
  nonce: number
}

const EMPTY: ChannelState = { text: "", nonce: 0 }

export function LiveAnnouncerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [polite, setPolite] = React.useState<ChannelState>(EMPTY)
  const [assertive, setAssertive] = React.useState<ChannelState>(EMPTY)

  const politeTimer = React.useRef<number | null>(null)
  const assertiveTimer = React.useRef<number | null>(null)
  const politePending = React.useRef<string | null>(null)
  const assertivePending = React.useRef<string | null>(null)

  React.useEffect(() => {
    return () => {
      if (politeTimer.current) window.clearTimeout(politeTimer.current)
      if (assertiveTimer.current) window.clearTimeout(assertiveTimer.current)
    }
  }, [])

  const flushPolite = React.useCallback(() => {
    politeTimer.current = null
    const next = politePending.current
    politePending.current = null
    if (next === null) return
    setPolite((prev) => ({ text: next, nonce: prev.nonce + 1 }))
  }, [])

  const flushAssertive = React.useCallback(() => {
    assertiveTimer.current = null
    const next = assertivePending.current
    assertivePending.current = null
    if (next === null) return
    setAssertive((prev) => ({ text: next, nonce: prev.nonce + 1 }))
  }, [])

  const announce = React.useCallback(
    (message: string, priority: AnnouncementPriority = "polite") => {
      const trimmed = message.trim()
      if (priority === "assertive") {
        assertivePending.current = trimmed
        if (assertiveTimer.current === null) {
          assertiveTimer.current = window.setTimeout(flushAssertive, DEBOUNCE_MS)
        }
      } else {
        politePending.current = trimmed
        if (politeTimer.current === null) {
          politeTimer.current = window.setTimeout(flushPolite, DEBOUNCE_MS)
        }
      }
    },
    [flushAssertive, flushPolite]
  )

  const value = React.useMemo<LiveAnnouncerContextValue>(
    () => ({ announce }),
    [announce]
  )

  return (
    <LiveAnnouncerContext.Provider value={value}>
      {children}
      <LiveAnnouncerRegions polite={polite} assertive={assertive} />
    </LiveAnnouncerContext.Provider>
  )
}

function LiveAnnouncerRegions({
  polite,
  assertive,
}: {
  polite: ChannelState
  assertive: ChannelState
}) {
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {/* The key forces the text node to remount, which reliably triggers
            screen-reader announcements even when the same text repeats. */}
        <span key={polite.nonce}>{polite.text}</span>
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        <span key={assertive.nonce}>{assertive.text}</span>
      </div>
    </>
  )
}

export function useLiveAnnouncerContext(): LiveAnnouncerContextValue {
  const ctx = React.useContext(LiveAnnouncerContext)
  if (!ctx) {
    throw new Error(
      "useLiveAnnouncerContext must be used inside <LiveAnnouncerProvider>"
    )
  }
  return ctx
}
