import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { TranscriptTurn } from "@/types/assistant"

type Props = {
  userTurns: TranscriptTurn[]
  assistantTurns: TranscriptTurn[]
  userDraft: string
  assistantDraft: string
}

export function TranscriptPanel({
  userTurns,
  assistantTurns,
  userDraft,
  assistantDraft,
}: Props) {
  const [open, setOpen] = useState(false)
  const interleaved = interleaveTurns(userTurns, assistantTurns)
  const hasContent =
    interleaved.length > 0 || userDraft.length > 0 || assistantDraft.length > 0

  return (
    <section>
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls="transcript-content"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full justify-between px-2 text-xs text-muted-foreground"
      >
        <span>Transcript</span>
        {open ? (
          <ChevronDown aria-hidden="true" className="size-4" />
        ) : (
          <ChevronUp aria-hidden="true" className="size-4" />
        )}
      </Button>
      <div
        id="transcript-content"
        aria-hidden={!open}
        className={open ? "mt-2" : "hidden"}
      >
        {!hasContent ? (
          <p className="px-2 text-xs text-muted-foreground">
            No transcript yet.
          </p>
        ) : (
          <ol className="flex flex-col gap-1 px-2 text-sm">
            {interleaved.map((turn, i) => (
              <li key={i}>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {turn.role === "user" ? "You" : "Assistant"}:{" "}
                </span>
                <span>{turn.text}</span>
              </li>
            ))}
            {userDraft && (
              <li className="opacity-70">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  You:{" "}
                </span>
                <span>{userDraft}</span>
              </li>
            )}
            {assistantDraft && (
              <li className="opacity-70">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Assistant:{" "}
                </span>
                <span>{assistantDraft}</span>
              </li>
            )}
          </ol>
        )}
      </div>
    </section>
  )
}

function interleaveTurns(
  user: TranscriptTurn[],
  assistant: TranscriptTurn[]
): TranscriptTurn[] {
  const out: TranscriptTurn[] = []
  const len = Math.max(user.length, assistant.length)
  for (let i = 0; i < len; i++) {
    if (user[i]) out.push(user[i])
    if (assistant[i]) out.push(assistant[i])
  }
  return out
}
