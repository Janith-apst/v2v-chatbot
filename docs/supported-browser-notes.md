# Supported browser notes

The voice loop relies on:

- `navigator.mediaDevices.getUserMedia`
- `AudioContext`
- `AudioWorkletNode` (modern, replaces the deprecated `ScriptProcessorNode`)
- `AudioBufferSourceNode`
- WebSocket (used by the `@google/genai` SDK under the hood)
- `navigator.vibrate` (optional; haptics gracefully no-op when absent)

## Browser matrix

| Browser | Voice loop | Vibration | PWA install | Notes |
|---|---|---|---|---|
| Chrome desktop (latest) | ✅ | n/a (desktop) | ✅ | Primary dev target. |
| Edge desktop (latest) | ✅ | n/a | ✅ | Same engine as Chrome. |
| Safari macOS 14+ | ✅ | n/a | ⚠ Limited PWA install | AudioContext often starts suspended; resumed on user gesture (Start button). |
| Safari iOS 17+ | ✅ | ⚠ Partial | ✅ from "Add to Home Screen" | Audio playback **must** be initiated by a user gesture. The Start button satisfies this. Background tabs may suspend audio. |
| Chrome Android (latest) | ✅ | ✅ | ✅ | Best mobile experience. |
| Firefox (latest) | ❌ | ✅ | ❌ for installable PWA on desktop | AudioWorklet is supported but mic + Live API combinations have not been validated; the app currently presents an `unsupported` state if any prerequisite is missing. |
| Older browsers | ❌ | ❌ | ❌ | The app shows an `unsupported` state and disables Start. |

## Known quirks

- **iOS Safari**: the user must tap the page (i.e. the Start button) before any audio can play. The flow already requires that, so this is not a regression.
- **HTTPS requirement**: `getUserMedia` only works over HTTPS or on `localhost`. The local POC runs on `http://localhost:5173` and is fine.
- **Service worker + Live API**: the SW is configured to **not** intercept Gemini traffic. Live API requests are realtime and must reach the network.
- **Vibration on iOS**: `navigator.vibrate` is not implemented in iOS Safari at all. The Settings panel labels the Vibration switch as unavailable on those devices.
- **Bluetooth audio**: barge-in latency is higher with Bluetooth headsets due to codec buffering. The flush is still issued promptly; the perceived cut is bounded by the headset's pipeline.

## Feature detection

Detection runs once on mount inside `useVoiceAssistant`, in `src/lib/audio/support.ts`:

```ts
detectAudioSupport() // → { ok, audioContext, audioWorklet, getUserMedia, reason? }
```

If `ok` is false, the app enters `status='unsupported'` synchronously, announces the reason on the assertive channel, and disables the primary button. No mic prompt appears.
