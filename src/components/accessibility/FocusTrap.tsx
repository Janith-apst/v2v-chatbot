import * as React from "react"

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

type Props = {
  active?: boolean
  onClose?: () => void
  initialFocus?: React.RefObject<HTMLElement | null>
  returnFocus?: boolean
  children: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>

export function FocusTrap({
  active = true,
  onClose,
  initialFocus,
  returnFocus = true,
  children,
  ...rest
}: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const previouslyFocused = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!active) return
    previouslyFocused.current = document.activeElement as HTMLElement | null

    const target =
      initialFocus?.current ?? findFirstFocusable(containerRef.current)
    target?.focus()

    return () => {
      if (returnFocus) previouslyFocused.current?.focus()
    }
  }, [active, initialFocus, returnFocus])

  React.useEffect(() => {
    if (!active) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation()
        onClose?.()
        return
      }
      if (event.key !== "Tab") return
      const container = containerRef.current
      if (!container) return
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const current = document.activeElement as HTMLElement | null
      if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [active, onClose])

  return (
    <div ref={containerRef} {...rest}>
      {children}
    </div>
  )
}

function findFirstFocusable(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null
  const el = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
  return el
}
