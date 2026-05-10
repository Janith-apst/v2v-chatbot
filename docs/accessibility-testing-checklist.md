# Accessibility Testing Checklist

Manual checks to run before any release of the voice assistant. Each section has a clear pass/fail target.

## 1. Keyboard

- [ ] Open the app fresh. The primary "Start listening" button is focused on load.
- [ ] Press **Tab** repeatedly. Focus order is: Primary button → Stop speaking → Repeat → Help → Settings → Transcript toggle → footer text. No hidden controls receive focus.
- [ ] Press **Shift+Tab** to confirm reverse order.
- [ ] **Space** or **Enter** on the focused primary button starts/stops listening.
- [ ] **Escape** while assistant is speaking silences it. State returns to "Listening".
- [ ] **Escape** with the session active but silent ends the session.
- [ ] **R** triggers the Repeat action (only after the first complete response).
- [ ] **?** opens the Help dialog.
- [ ] **D** toggles light/dark theme (existing).
- [ ] In an open Help/Settings dialog, **Tab** cycles only within the dialog. **Shift+Tab** at the first element wraps to the last.
- [ ] **Escape** closes the dialog. Focus returns to the button that opened it.

## 2. Screen reader

Repeat with each available SR (priority: macOS VoiceOver, iOS VoiceOver, Android TalkBack).

- [ ] Page title announces "Voice Assistant".
- [ ] On load, the polite live region announces the readiness message ("Ready. Press start listening or the space bar to begin.").
- [ ] Primary button announces its label, role (button), and any state ("aria-disabled" when in a busy state).
- [ ] Mute, Stop, Repeat, Help, Settings buttons each have a clear accessible name.
- [ ] State transitions are announced exactly once per change (debouncing prevents stutter at rapid changes).
- [ ] Entering "permission-required" or "unsupported" announces via the **assertive** channel.
- [ ] The transcript region is silent unless explicitly expanded by the user.
- [ ] Help dialog is announced with name, role=dialog, modal. First focusable element is focused.

## 3. Mobile touch

- [ ] The main talk area is the entire viewport minus the header and the small footer hint. Tapping anywhere inside it acts on the primary button.
- [ ] Header Help and Settings icons are at least 48 px square and have visible spacing.
- [ ] No two interactive elements overlap or sit closer than ~8 px.
- [ ] Layout works in portrait at the default text size and at 200% browser zoom.
- [ ] Rotating from portrait to landscape preserves state and does not crash.

## 3a. Touch gestures

- [ ] Single tap inside the talk area starts listening; another tap stops listening.
- [ ] Swipe down (≥60 px vertical movement) while the assistant is speaking silences it within ~200 ms. Status returns to "Listening".
- [ ] Swipe up (≥60 px vertical movement) after a complete response replays it.
- [ ] Swipe up before any response polite-announces "No response to repeat yet."
- [ ] Two-finger tap (both fingers down briefly, no movement) opens the Help dialog.
- [ ] Horizontal swipes do **not** trigger any action — the browser's back/forward gestures still work.
- [ ] Long press does not trigger an unintended start/stop.

## 4. Voice flow

- [ ] Tap **Start listening**. Browser permission prompt appears once. After granting, status reaches "Listening" within a few seconds.
- [ ] Speak a short question. Status moves to "Checking that" briefly, then "Speaking response".
- [ ] Speak again while the assistant is talking. Assistant audio cuts within ~200 ms (barge-in).
- [ ] Press **Stop speaking** during a response. Audio cuts immediately, mic stays open, status returns to "Listening".
- [ ] Press **Repeat** after a complete response. The same audio replays exactly.
- [ ] Say "stop" (or "be quiet"). Audio cuts as if Stop speaking were pressed.
- [ ] Say "repeat that". Last response replays.
- [ ] Say "help". Help dialog opens.
- [ ] Deny mic permission. Status enters "permission-required" with friendly assertive copy.

## 5. Reduced motion

- [ ] Enable reduced motion in OS (macOS System Settings → Accessibility → Display → Reduce motion; or Chrome `prefers-reduced-motion: reduce`).
- [ ] Reload. Confirm dialog open/close has no animation, no transitions on hover/focus, and `tw-animate-css` animations are inert.
- [ ] State changes still convey via text + announcement + (where supported) haptic.

## 6. Browser support gating

- [ ] Open in Firefox (no AudioWorklet) or test by stubbing `delete window.AudioWorkletNode` before mount. Status is "unsupported" and the primary button is `aria-disabled`. Assertive copy explains why.
- [ ] Open over `http://` (no localhost). The browser blocks `getUserMedia`; status reports an unsupported reason.

## 7. PWA install

- [ ] In Chrome desktop, the install icon appears in the address bar.
- [ ] Installed app launches in standalone mode and runs the same flow.
- [ ] Service worker is registered and serves the shell offline (the Live API itself remains online-only by design).
