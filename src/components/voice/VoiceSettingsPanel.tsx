import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { useHaptics } from "@/hooks/useHaptics"
import {
  useSettings,
  type SpeechSpeed,
  type Verbosity,
} from "@/hooks/useSettings"
import { useSoundEffects } from "@/hooks/useSoundEffects"

type Props = {
  open: boolean
  onClose: () => void
}

export function VoiceSettingsPanel({ open, onClose }: Props) {
  const { settings, setSetting, resetSettings } = useSettings()
  const { theme, setTheme } = useTheme()
  const haptics = useHaptics()
  const sfx = useSoundEffects()

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DrawerContent
        className="px-4 pb-6"
        aria-describedby="settings-description"
      >
        <DrawerHeader className="px-0">
          <DrawerTitle>Settings</DrawerTitle>
          <DrawerDescription id="settings-description">
            Adjust speech speed, verbosity, and feedback.
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 overflow-auto pr-1">
          <fieldset className="rounded-md border p-4">
            <legend className="px-1 text-base font-medium">Theme</legend>
            <p className="mb-2 text-xs text-muted-foreground">
              Match the system or pick a fixed appearance.
            </p>
            <RadioGroup
              name="theme"
              value={theme}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              onChange={(value) =>
                setTheme(value as "system" | "light" | "dark")
              }
            />
          </fieldset>

          <fieldset className="rounded-md border p-4">
            <legend className="px-1 text-base font-medium">
              Speech speed
            </legend>
            <p className="mb-2 text-xs text-muted-foreground">
              Adjusts playback rate of the assistant&apos;s voice.
            </p>
            <RadioGroup
              name="speechSpeed"
              value={settings.speechSpeed}
              options={[
                { value: "slow", label: "Slow" },
                { value: "normal", label: "Normal" },
                { value: "fast", label: "Fast" },
              ]}
              onChange={(value) =>
                setSetting("speechSpeed", value as SpeechSpeed)
              }
            />
          </fieldset>

          <fieldset className="rounded-md border p-4">
            <legend className="px-1 text-base font-medium">Verbosity</legend>
            <p className="mb-2 text-xs text-muted-foreground">
              Hint for how detailed responses should be. Applies to new sessions.
            </p>
            <RadioGroup
              name="verbosity"
              value={settings.verbosity}
              options={[
                { value: "short", label: "Short" },
                { value: "detailed", label: "Detailed" },
              ]}
              onChange={(value) => setSetting("verbosity", value as Verbosity)}
            />
          </fieldset>

          <div className="flex flex-col gap-3 rounded-md border p-4">
            <ToggleRow
              label="Vibration"
              description={
                haptics.supported
                  ? "Use haptic feedback for state changes."
                  : "Vibration is not available on this device."
              }
              checked={settings.vibration}
              disabled={!haptics.supported}
              onChange={(checked) => setSetting("vibration", checked)}
            />
            <ToggleRow
              label="Sound effects"
              description={
                sfx.supported
                  ? "Play short tones for state changes."
                  : "Sound effects are not available on this device."
              }
              checked={settings.soundEffects}
              disabled={!sfx.supported}
              onChange={(checked) => setSetting("soundEffects", checked)}
            />
            <ToggleRow
              label="Auto-speak responses"
              description="Play assistant audio as soon as it arrives."
              checked={settings.autoSpeak}
              onChange={(checked) => setSetting("autoSpeak", checked)}
            />
          </div>

          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetSettings}
              aria-label="Reset settings to defaults"
            >
              Reset to defaults
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function RadioGroup({
  name,
  value,
  options,
  onChange,
}: {
  name: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const id = `${name}-${option.value}`
        const checked = option.value === value
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={
              checked
                ? "inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-md border-2 border-primary bg-primary/10 px-4 py-2 text-base"
                : "inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-md border bg-background px-4 py-2 text-base hover:bg-muted"
            }
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="size-4"
            />
            <span>{option.label}</span>
          </label>
        )
      })}
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="flex flex-col">
        <span className="text-base font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-6"
      />
    </label>
  )
}
