import { useEffect, useRef } from "react"

export type TouchGestureHandlers = {
  onTap?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  onTwoFingerTap?: () => void
}

type Options = {
  enabled?: boolean
  // Minimum pixel travel to count as a swipe.
  swipeThreshold?: number
  // Maximum gesture duration in ms.
  maxGestureMs?: number
}

type StartPoint = {
  id: number
  x: number
  y: number
  t: number
}

/**
 * Attach unobtrusive touch gestures to a target element. Designed for a
 * single full-screen tap target:
 *  - single-finger tap (no movement)            -> onTap
 *  - single-finger upward swipe                 -> onSwipeUp
 *  - single-finger downward swipe               -> onSwipeDown
 *  - two-finger tap (no movement, both fingers) -> onTwoFingerTap
 *
 * Swipes left/right are intentionally ignored so the browser can handle
 * back/forward gestures.
 */
export function useTouchGestures(
  targetRef: React.RefObject<HTMLElement | null>,
  handlers: TouchGestureHandlers,
  {
    enabled = true,
    swipeThreshold = 60,
    maxGestureMs = 700,
  }: Options = {}
) {
  // Use a ref to keep latest handlers without re-binding listeners on every render.
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!enabled) return
    const el = targetRef.current
    if (!el) return

    const startPoints = new Map<number, StartPoint>()
    let twoFingerActive = false
    let twoFingerMoved = false

    function onTouchStart(event: TouchEvent) {
      const now = performance.now()
      for (const t of Array.from(event.changedTouches)) {
        startPoints.set(t.identifier, {
          id: t.identifier,
          x: t.clientX,
          y: t.clientY,
          t: now,
        })
      }
      if (event.touches.length === 2) {
        twoFingerActive = true
        twoFingerMoved = false
      }
    }

    function onTouchMove(event: TouchEvent) {
      if (twoFingerActive) {
        for (const t of Array.from(event.changedTouches)) {
          const start = startPoints.get(t.identifier)
          if (!start) continue
          if (
            Math.abs(t.clientX - start.x) > 12 ||
            Math.abs(t.clientY - start.y) > 12
          ) {
            twoFingerMoved = true
          }
        }
      }
    }

    function onTouchEnd(event: TouchEvent) {
      const now = performance.now()
      const ended = Array.from(event.changedTouches)

      // Two-finger tap: detect when the *second* finger lifts and neither moved.
      if (twoFingerActive && event.touches.length === 0) {
        if (!twoFingerMoved) {
          // Verify both starts were close in time.
          const starts = Array.from(startPoints.values())
          if (
            starts.length >= 2 &&
            Math.abs(starts[0].t - starts[1].t) < 250 &&
            now - Math.max(starts[0].t, starts[1].t) < maxGestureMs
          ) {
            handlersRef.current.onTwoFingerTap?.()
            startPoints.clear()
            twoFingerActive = false
            twoFingerMoved = false
            return
          }
        }
        twoFingerActive = false
        twoFingerMoved = false
      }

      // Single-finger gestures: process each ended touch.
      for (const t of ended) {
        const start = startPoints.get(t.identifier)
        startPoints.delete(t.identifier)
        if (!start) continue
        // Skip if this touch was part of a multi-touch gesture.
        if (event.touches.length > 0) continue
        const dx = t.clientX - start.x
        const dy = t.clientY - start.y
        const dt = now - start.t
        if (dt > maxGestureMs) continue

        const absX = Math.abs(dx)
        const absY = Math.abs(dy)

        if (absX < 10 && absY < 10) {
          // Plain tap. Only fire when there are zero remaining fingers and we
          // weren't in the middle of a two-finger gesture.
          if (!twoFingerActive) {
            handlersRef.current.onTap?.()
          }
          continue
        }

        // Vertical-dominant swipe.
        if (absY > absX && absY >= swipeThreshold) {
          if (dy < 0) handlersRef.current.onSwipeUp?.()
          else handlersRef.current.onSwipeDown?.()
        }
        // Horizontal swipes are intentionally ignored.
      }

      if (event.touches.length === 0) {
        startPoints.clear()
        twoFingerActive = false
        twoFingerMoved = false
      }
    }

    function onTouchCancel() {
      startPoints.clear()
      twoFingerActive = false
      twoFingerMoved = false
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: true })
    el.addEventListener("touchend", onTouchEnd, { passive: true })
    el.addEventListener("touchcancel", onTouchCancel, { passive: true })

    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("touchcancel", onTouchCancel)
    }
  }, [enabled, maxGestureMs, swipeThreshold, targetRef])
}
