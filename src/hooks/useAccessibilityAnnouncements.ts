import { useCallback } from "react"

import { useLiveAnnouncerContext } from "@/components/accessibility/LiveAnnouncer"

export function useAccessibilityAnnouncements() {
  const { announce } = useLiveAnnouncerContext()

  const announcePolite = useCallback(
    (message: string) => announce(message, "polite"),
    [announce]
  )
  const announceAssertive = useCallback(
    (message: string) => announce(message, "assertive"),
    [announce]
  )

  return { announcePolite, announceAssertive }
}
