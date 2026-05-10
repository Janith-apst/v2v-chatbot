import { useEffect } from "react"

export type ShortcutHandler = (event: KeyboardEvent) => void

export type ShortcutMap = Record<string, ShortcutHandler>

type Options = {
  ignoreEditable?: boolean
  enabled?: boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const editable = target.closest(
    "input, textarea, select, [contenteditable='true']"
  )
  return editable !== null
}

function normalizeKey(key: string): string {
  if (key === " " || key === "Spacebar") return "Space"
  return key.length === 1 ? key.toLowerCase() : key
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutMap,
  { ignoreEditable = true, enabled = true }: Options = {}
) {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (ignoreEditable && isEditableTarget(event.target)) return
      const key = normalizeKey(event.key)
      const handler = shortcuts[key]
      if (handler) {
        handler(event)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [shortcuts, ignoreEditable, enabled])
}
