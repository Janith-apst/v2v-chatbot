# Voice Assistant POC

A frontend-only React + Vite PWA that holds a realtime full-duplex voice conversation with Gemini via the Live API. Designed accessibility-first for blind and low-vision users.

For the original Phase 1 brief see [SPEC.md](./SPEC.md). For the accessibility-first refactor see [docs/accessibility-audit.md](./docs/accessibility-audit.md).

## Security warning — read before running

This phase has no backend. The Gemini API key is read from a `VITE_*` environment variable, which means it is **bundled into the client JavaScript** and visible to anyone who loads the page.

Acceptable only when:

- The app runs on `localhost`
- The key is a restricted, low-quota dev key
- The build is **not** deployed publicly

A token-vending service will replace this approach before any public demo.

## How to run

```bash
cp .env.example .env.local
# put your Gemini API key in .env.local
pnpm install
pnpm dev
```

Open <http://localhost:5173>, press **Start listening** (or hit Space), grant the microphone permission, then speak. You can interrupt the assistant at any time by speaking over it.

## Scripts

```bash
pnpm dev         # vite dev server
pnpm typecheck   # tsc --noEmit
pnpm build       # tsc -b && vite build
pnpm preview     # preview production build
pnpm lint
pnpm format
```

Set `VITE_DEBUG=1` to force-show the debug events panel in production builds. It is on automatically in `pnpm dev`.

## Accessibility-first design

The app is structured around the **voice loop**, not a chat timeline. The main screen is a single full-screen tap target. Help and Settings live as small icon buttons in the header. Stop-speaking and Repeat have no dedicated buttons in the main flow — they are reachable via touch gestures, voice commands, and keyboard.

Every state change is announced through a centralized live region (polite or assertive). All controls are native `<button>` with explicit `aria-label`. Focus management, focus traps for dialogs, and reduced-motion handling are wired in. Browser-API support is detected on mount; unsupported environments enter an `unsupported` state and explain why.

See [docs/voice-ux-rules.md](./docs/voice-ux-rules.md) for content rules and [docs/accessibility-testing-checklist.md](./docs/accessibility-testing-checklist.md) for the manual QA pass.

### Touch gestures

| Gesture | Action |
|---|---|
| Tap (anywhere in the main area) | Start or stop listening |
| Swipe down | Stop assistant speech |
| Swipe up | Repeat the last response |
| Two-finger tap | Open the Help dialog |

Horizontal swipes are intentionally ignored so the browser's back/forward gestures keep working.

### Keyboard

| Key | Action |
|---|---|
| Tab / Shift+Tab | Move focus through controls |
| Space / Enter | Activate focused button |
| Escape | Stop assistant speech (then end session if pressed again while silent) |
| R | Repeat the last response |
| ? | Open the Help dialog |
| D | Toggle light / dark theme |

### Voice commands (parsed locally)

"stop", "be quiet", "cancel", "never mind", "repeat", "say that again", "speak slower", "speak faster", "help", "what can I say".

### Testing with VoiceOver / TalkBack

- **macOS VoiceOver:** ⌘ + F5 to enable. Tab through the controls. Status changes should be announced once per change. Help/Settings dialogs trap focus.
- **iOS VoiceOver:** Triple-click the side button (or via Settings → Accessibility). The Start button must be tapped to trigger audio context unlock — already part of the flow.
- **Android TalkBack:** Volume-up + Volume-down to toggle. Same control set; haptics are honored.

See [docs/supported-browser-notes.md](./docs/supported-browser-notes.md) for known browser limitations.

## Stack

React 19, Vite 7, TypeScript (strict), Tailwind v4, shadcn/ui (radix-vega), `@google/genai` (Gemini Live API), `vite-plugin-pwa`. Mic capture via `AudioWorklet` (16 kHz PCM16). Playback via a queued `AudioBufferSourceNode` chain (24 kHz).

## Project layout

```
src/
  components/
    accessibility/    # LiveAnnouncer, VisuallyHidden, FocusTrap
    ui/               # shadcn primitives (Button)
    voice/            # AssistantStatus, PrimaryVoiceButton, AssistantControls,
                      # VoiceHelpDialog, VoiceSettingsPanel, VoiceAssistantShell,
                      # TranscriptPanel, DebugPanel
  hooks/              # useVoiceAssistant (orchestrator),
                      # useSpeechRecognition / useSpeechSynthesis facades,
                      # useAccessibilityAnnouncements, useHaptics,
                      # useReducedMotion, useKeyboardShortcuts, useSettings
  lib/
    audio/            # mic-recorder, audio-player, mic-worklet, pcm16, support
    gemini/           # live-client, gemini-config
  services/           # commandParser, assistantClient
  types/              # AssistantState, TranscriptTurn, DebugEvent
  styles/             # accessibility.css
docs/                 # accessibility-audit, testing-checklist, voice-ux-rules,
                      # supported-browser-notes
```
