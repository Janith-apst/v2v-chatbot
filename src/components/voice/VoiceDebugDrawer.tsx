import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import type { DebugEvent } from "@/types/assistant"

type Props = {
  open: boolean
  onClose: () => void
  events: DebugEvent[]
}

export function VoiceDebugDrawer({ open, onClose, events }: Props) {
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DrawerContent
        className="px-4 pb-6"
        aria-describedby="debug-description"
      >
        <DrawerHeader className="px-0">
          <DrawerTitle>Debug events</DrawerTitle>
          <DrawerDescription id="debug-description">
            Internal events from the voice session. Useful for diagnosing.
          </DrawerDescription>
        </DrawerHeader>
        <ol
          aria-label="Debug events"
          className="max-h-[60svh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs"
        >
          {events.length === 0 && (
            <li className="text-muted-foreground">No events yet.</li>
          )}
          {events.map((e, i) => (
            <li key={i} className="py-0.5">
              <span className="text-muted-foreground">{formatTime(e.at)}</span>{" "}
              <span className="font-semibold">{e.event}</span>
              {e.data !== undefined && (
                <span className="text-muted-foreground">
                  {" "}
                  {safeStringify(e.data)}
                </span>
              )}
            </li>
          ))}
        </ol>
      </DrawerContent>
    </Drawer>
  )
}

function formatTime(ms: number): string {
  const d = new Date(ms)
  return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, "0")}`
}

function safeStringify(value: unknown): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value)
  } catch {
    return String(value)
  }
}
