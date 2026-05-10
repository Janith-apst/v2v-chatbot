import { Bug, HelpCircle, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"

type Props = {
  onOpenHelp: () => void
  onOpenSettings: () => void
  onOpenDebug?: () => void
}

export function HeaderActions({
  onOpenHelp,
  onOpenSettings,
  onOpenDebug,
}: Props) {
  return (
    <div
      role="group"
      aria-label="Utility actions"
      className="flex items-center gap-1"
    >
      {onOpenDebug && (
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Open debug events"
          onClick={onOpenDebug}
        >
          <Bug aria-hidden="true" className="size-5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label="Open help"
        aria-keyshortcuts="?"
        onClick={onOpenHelp}
      >
        <HelpCircle aria-hidden="true" className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label="Open settings"
        onClick={onOpenSettings}
      >
        <Settings aria-hidden="true" className="size-5" />
      </Button>
    </div>
  )
}
