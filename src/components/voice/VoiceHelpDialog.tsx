import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

type Props = {
  open: boolean
  onClose: () => void
}

export function VoiceHelpDialog({ open, onClose }: Props) {
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DrawerContent
        className="px-4 pb-6"
        aria-describedby="help-description"
      >
        <DrawerHeader className="px-0">
          <DrawerTitle>Help</DrawerTitle>
          <DrawerDescription id="help-description">
            How to use the voice assistant.
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-5 overflow-auto pr-1">
          <section>
            <h3 className="mb-2 text-base font-medium">Touch gestures</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Tap anywhere — start or stop listening.</li>
              <li>Swipe down — stop assistant speech.</li>
              <li>Swipe up — repeat the last response.</li>
              <li>Two-finger tap — open this help drawer.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-base font-medium">Keyboard shortcuts</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>
                <kbd>Space</kbd> or <kbd>Enter</kbd> — activate the focused
                button.
              </li>
              <li>
                <kbd>Escape</kbd> — stop assistant speech, then end session.
              </li>
              <li>
                <kbd>R</kbd> — repeat the last response.
              </li>
              <li>
                <kbd>?</kbd> — open this help drawer.
              </li>
              <li>
                <kbd>D</kbd> — toggle light or dark theme.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-base font-medium">Voice commands</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>"stop" or "be quiet" — stops speech.</li>
              <li>"cancel" or "never mind" — stops speech.</li>
              <li>"repeat" or "say that again" — repeats the last response.</li>
              <li>"help" or "what can I say" — opens this drawer.</li>
              <li>"speak slower" / "speak faster" — opens settings.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-base font-medium">If the microphone fails</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Make sure the site has microphone permission.</li>
              <li>Reload the page.</li>
              <li>Try a different browser. Chrome, Edge, and recent Safari are best supported.</li>
            </ol>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
