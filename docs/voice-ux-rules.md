# Voice UX Rules

House rules for what the assistant says, when, and how. These are derived from the accessibility brief and tuned for blind/low-vision users where the audio is the primary channel.

## Response style

- **Short first.** Open with the answer in one sentence. Offer detail only if the user asks.
- **One claim per sentence.** Sentences should be parseable on first listen.
- **No long lists.** If the user asks for options, give two or three with a brief tag, then offer "say 'more options' to hear more".
- **No reading punctuation aloud.** Do not say "comma" or "period". The TTS layer handles that.
- **No filler.** Skip "Great question", "Sure thing", "Okay let me think" — these waste airtime in a voice product.
- **Don't read the user's question back.** Confirm understanding only when you would otherwise act on it.

## Confirmation pattern (sensitive actions)

For any real-world action — calling, sending, sharing, navigating, paying, deleting — the assistant must say:

> "I can do that. Say 'confirm' to continue, or 'cancel' to stop."

The action only fires after the user explicitly says **confirm**. "Yes" alone is not enough for irreversible operations.

> Phase 1 has no real-world actions wired up. The pattern is documented here so that when actions land, the contract is already clear.

## State copy (visible + spoken)

The assistant's UI status text matches the spoken/announced state. Keep them identical for predictability.

| State | Copy |
|---|---|
| ready | "Ready. Press start listening or the space bar to begin." |
| requesting-mic | "Requesting microphone permission." |
| permission-required | "Microphone access is needed to hear you." |
| connecting | "Connecting to the assistant." |
| listening | "Listening. Speak now." |
| processing | "Checking that." |
| speaking | "Speaking response. You can interrupt at any time." |
| stopping | "Stopping." |
| closed | "Conversation ended." |
| error | (specific friendly message, see below) |
| unsupported | (specific friendly message, see below) |

## Error copy

Each error message must:
1. Say what failed in one short clause.
2. Tell the user how to recover.
3. Avoid technical detail (no error codes, no stack traces).

| Case | Copy |
|---|---|
| Missing API key | "API key missing. Set VITE_GEMINI_API_KEY in your .env.local file and restart the dev server." |
| Mic permission denied | "I could not access the microphone. Please grant permission in your browser settings and try again." |
| Connect failure | "I could not connect to the assistant. Check your connection and press start to retry." |
| AudioWorklet unsupported | "This browser is missing AudioWorklet support, which is required for low-latency voice. Try the latest Chrome, Edge, or Safari." |
| getUserMedia missing | "Microphone access is unavailable on this device or browser. Try the latest Chrome, Edge, or Safari over HTTPS or on localhost." |
| No speech detected (≥30 s) | "I did not hear anything. Try speaking again, or press stop to end." (planned, polite channel) |

## Confirmation, repeat, and stop

- Repeat replays the last fully-received response from a local snapshot. It does **not** re-call the model.
- Stop speaking flushes the audio queue and stops the current source within ~200 ms. It keeps the session alive and the mic open.
- End session is the destructive control: tear down the connection. Used by the primary button when the session is active and silent.

## Voice-command vocabulary

The local parser recognizes (case-insensitive, partial-phrase):

- stop, be quiet, silence, stop talking, stop speaking
- cancel, never mind, forget it
- repeat, repeat that, say that again
- speak slower, slow down, talk slower
- speak faster, speed up, talk faster
- help, what can I say, list commands

Recognized commands run the local action **immediately**; the model's eventual response is allowed to come through normally and barge-in handles overlap.

## Privacy-first permission copy

When the mic prompt is about to appear, announce the reason on the polite channel beforehand: "Microphone access is needed so you can speak to the assistant." Do not ask for location or other sensitive permissions on startup.
