# Accessibility Audit — Voice-to-Voice Chatbot

> Snapshot taken at the start of the accessibility-first refactor. This is the audit deliverable from Phase 1 of the refactor plan. The state of the codebase described below is **before** Pass A's foundation work lands. Items addressed in subsequent passes are marked.

## 1. Architecture map (current)

### Modules
| Path | Role | Notes |
|---|---|---|
| `src/lib/audio/pcm16.ts` | PCM16↔Float32 conversions, base64, naive downsampler | Pure functions. **Keep.** |
| `src/lib/audio/mic-worklet.js` | `AudioWorkletProcessor` running on the audio thread | Forwards Float32 frames to the main thread. **Keep.** |
| `src/lib/audio/mic-recorder.ts` | `getUserMedia` + worklet glue, batches to ~100 ms 16 kHz PCM16 | Calls `audioContext.audioWorklet.addModule()` unconditionally. **Refactor lightly** (feature detection in Pass B). |
| `src/lib/audio/audio-player.ts` | 24 kHz queued playback via `AudioBufferSourceNode` chain with `flush()` for barge-in | Will be extended in Pass B with `startTurn`/`endTurn`/`replayLastTurn` for the Repeat feature. |
| `src/lib/gemini/live-client.ts` | Wraps `@google/genai` `ai.live.connect`; emits typed events | **Keep.** Pass B will add the ability to send `activityEnd`. |
| `src/lib/gemini/gemini-config.ts` | System instruction + default model | **Keep.** |
| `src/hooks/useVoiceSession.ts` | State orchestrator | Renamed to `useVoiceAssistant` in Pass B; new states added. |
| `src/components/voice/VoiceChat.tsx` | Top-level layout | Replaced by `VoiceAssistantShell.tsx` in Pass B. |
| `src/components/voice/VoiceControls.tsx` | Big primary button + Mute + Reset | Split into `PrimaryVoiceButton` + `AssistantControls` in Pass B. |
| `src/components/voice/VoiceStatus.tsx` | aria-live region + status text | Replaced by `AssistantStatus.tsx`. |
| `src/components/voice/TranscriptPanel.tsx` | Interleaved user/assistant turn list | Will become collapse-by-default + `aria-hidden` when collapsed. |
| `src/components/voice/DebugPanel.tsx` | Collapsible event ring buffer | DEV-gated in Pass B. |
| `src/components/theme-provider.tsx` | Light/dark + `D` key toggle | **Keep.** |
| `src/components/ui/button.tsx` | shadcn `Button` primitive | **Keep.** |

### Data flow
- **Up:** mic → AudioWorklet (Float32@deviceRate) → main-thread batch → `downsampleFloat32(48k→16k)` → `floatTo16BitPCM` → `base64Encode` → `session.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' }})`.
- **Down:** `onmessage` → `serverContent.modelTurn.parts[*].inlineData.data` (base64 24 kHz PCM16) → `base64Decode` → `Int16Array` → `int16ToFloat32` → `AudioBuffer` → enqueued at `nextStartTime`.
- **Interrupt:** `serverContent.interrupted === true` → `AudioPlayer.flush()` (stops outstanding sources, resets `nextStartTime`).

### State machine (current)
```
idle ──start──▶ requesting-mic ──granted──▶ connecting ──onOpen──▶ listening
                       │                                              │
                       └─denied─▶ error                              ▼ first audio
                                                                  speaking ──onInterrupted──▶ listening
                                                                     │
                                                                     └─turnComplete + !isPlaying─▶ listening
any ──stop──▶ closed
any ──onError──▶ error
```

Missing relative to brief: `ready`, `processing`, `permission-required`, `unsupported`, `stopping`. Added in Pass B.

## 2. Findings

### Semantic HTML — OK
All interactive elements are native `<button>` via the shadcn primitive at `src/components/ui/button.tsx`. No `role="button"` divs. `<section aria-label>` and `<details>` are used appropriately for transcript and debug.

### ARIA live regions — partial
`src/components/voice/VoiceStatus.tsx` has both polite (`role="status"`) and assertive (`role="alert"`) regions, but:
- They are inside the visible card, not SR-only — fine semantically, but means visual changes redundantly trigger SR re-announcements.
- **No debouncing.** Rapid status churn (e.g. requesting-mic → connecting in <100 ms) can produce stutter. `SPEC.md §11` notes the ≥500 ms target; current implementation has 0 ms.
- Only one channel of each. The brief expects a centralized `LiveAnnouncer` so non-status code (e.g. permission errors before render) can announce too.

### Focus management — partial
- Primary button is auto-focused on mount (`VoiceControls.tsx:35-37`). Good.
- `Escape` global handler stops session (`VoiceControls.tsx:40-58`). Good, but only stops session — no separate "stop speech."
- No focus trap exists because no dialog exists. The forthcoming Help/Settings dialogs require `FocusTrap`.

### Keyboard — partial
| Key | Currently | Expected (after Pass B) |
|---|---|---|
| Tab / Shift+Tab | Native | Native |
| Space / Enter | Native on primary button | Same + global activation while Tab order intact |
| Esc | Stops session | **Stops speech** (B), `endSession()` if already silent or via second press |
| R | none | Repeat last response |
| ? | none | Open Help dialog |
| D | Toggle theme (ThemeProvider) | Unchanged |

### Touch targets — mostly OK
- Primary button: `h-20` (80 px), full-width. Above 48 px.
- Mute / Reset: `h-14` (56 px). Above 48 px.
- shadcn default `Button size="default"` is `h-9` (36 px). **Below WCAG 2.2 AA 24 px minimum and below the brief's 48 px target.** Used only when explicitly chosen; we'll keep all interactive controls in the voice flow at `size="lg"` plus explicit min-heights.

### Reduced motion — missing
`src/index.css` has no `@media (prefers-reduced-motion: reduce)` rule. `tw-animate-css` is imported but no animations are currently visible. The CSS rule must still be added so future animations honor it without further work.

### Color-only state — OK
- Mute uses `aria-pressed` plus icon swap (`MicOff` ↔ `Mic`) plus text "Mute"/"Unmute".
- Status is text + ARIA, not color.
- Transcript turns labeled with text "You" / "Assistant" + color, not color alone.

### Permissions copy — weak
`getUserMedia` is requested without an explanatory message. The `useVoiceSession.start()` flow goes straight from `idle` to the browser's native prompt. After denial, the error copy is `"Microphone permission was denied. Please grant it in your browser settings and try again."` Improvement (Pass B): a brief assistive announcement at the start of the request explaining *why* the mic is needed.

### Error messages — mostly OK
- Missing API key: actionable.
- Mic denied: actionable, but doesn't mention reload.
- Connect failure: prefixed `"Connection failed: "` with raw SDK error, which can be inscrutable. Pass B reframes to friendly copy.

### Browser-API assumptions — high risk
No upfront feature detection for: `AudioContext`, `AudioWorkletNode`, `audioWorklet.addModule`, `getUserMedia`, `navigator.vibrate`. The `mic-recorder` will throw at runtime on unsupported browsers (notably older mobile Safari). Pass B adds detection at the top of `useVoiceAssistant` and a dedicated `unsupported` state/UI.

### Missing features
- **Help dialog** — none.
- **Settings panel** — none.
- **Repeat last response** — none. The audio is discarded once played.
- **Stop speech vs end session** — only end session exists today; pressing Stop while assistant talks tears the whole connection down.
- **Haptics** — none.
- **Debug panel gating** — always rendered; clutters SR output on real builds. DEV-gate in Pass B.
- **Voice command parser** — none.

## 3. Refactor plan

The plan in `~/.claude/plans/purpose-use-this-hazy-peach.md` (committed by the user as the working brief) divides the work into:

- **Pass A — foundation (this pass).** No behavior change to the voice loop. Adds: this audit doc, the accessibility CSS baseline, `LiveAnnouncer` + `VisuallyHidden` + `FocusTrap` components, and the `useAccessibilityAnnouncements` / `useReducedMotion` / `useHaptics` / `useKeyboardShortcuts` / `useSettings` hooks. Wires the announcer provider in `main.tsx`. Existing voice components unchanged.
- **Pass B — shell rebuild.** New `VoiceAssistantShell`, split controls, dialogs, the renamed orchestrator `useVoiceAssistant` and its facade hooks (`useSpeechRecognition`, `useSpeechSynthesis`), `commandParser`, `assistantClient`, audio-player snapshot/replay, error/unsupported states, supporting docs, README updates, and removal of the legacy components.

## 4. File disposition table

| Path | Disposition | Pass |
|---|---|---|
| `src/lib/audio/pcm16.ts` | Keep | — |
| `src/lib/audio/mic-worklet.js` | Keep | — |
| `src/lib/audio/mic-recorder.ts` | Keep (light feature-detect later) | B |
| `src/lib/audio/audio-player.ts` | Extend (snapshot/replay) | B |
| `src/lib/gemini/live-client.ts` | Keep (expose `activityEnd`) | B |
| `src/lib/gemini/gemini-config.ts` | Keep | — |
| `src/hooks/useVoiceSession.ts` | Rename → `useVoiceAssistant.ts`, behavioral changes | B |
| `src/components/voice/VoiceChat.tsx` | Replace with `VoiceAssistantShell.tsx` | B |
| `src/components/voice/VoiceControls.tsx` | Split into `PrimaryVoiceButton` + `AssistantControls` | B |
| `src/components/voice/VoiceStatus.tsx` | Replace with `AssistantStatus.tsx` | B |
| `src/components/voice/TranscriptPanel.tsx` | Modify (collapsed by default, aria-hidden) | B |
| `src/components/voice/DebugPanel.tsx` | Modify (DEV-gate) | B |
| `src/components/theme-provider.tsx` | Keep | — |
| `src/components/ui/button.tsx` | Keep | — |
| `src/lib/utils.ts` | Keep | — |
| `src/main.tsx` | Modify (provider + CSS import) | A |
| `src/index.css` | Keep (a11y CSS lives in a sibling file) | — |
| `src/App.tsx` | Modify (uses new shell) | B |
| `README.md` | Modify (a11y notes appended) | B |

## 5. Acceptance criteria mapping (brief → plan)

| Brief criterion | Where addressed |
|---|---|
| Native semantic controls | Already true; preserved by Pass B. |
| Accessible names on every control | A: existing buttons already have them; B: new buttons added with explicit `aria-label`. |
| Logical focus order | B: shell layout. |
| Live announcements with polite/assertive split | A: `LiveAnnouncer` + `useAccessibilityAnnouncements`. |
| Touch targets ≥48 px (primary much larger) | Already true; preserved. |
| Voice-first minimal UI | B: shell + collapse transcript. |
| State feedback through ≥2 channels | A: announcer; B: haptics, status text. |
| Haptics with detection + setting | A: `useHaptics`. |
| `prefers-reduced-motion` respected | A: CSS rule. |
| High contrast + visible focus ring | A: CSS rule. |
| Keyboard navigation incl. Esc/R/? | B: `useKeyboardShortcuts` registrations. |
| Local voice command parser | B: `commandParser`. |
| Confirmation flow pattern | Documented (out of scope until real actions exist). |
| Friendly error copy | B: per-case messages in error table. |
| Browser support realism | B: feature detection + `unsupported` state. |
| Privacy-first permission copy | B: announce *why* before mic prompt. |
