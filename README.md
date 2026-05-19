# Voice Assistant POC

A frontend-only React + Vite PWA.

## Important

There is **no backend**. All Gemini API calls are made directly from the browser, which means the API key is **bundled into the client JavaScript** and visible to anyone who loads the page. **we should not deploy this publicly.** Run it on `localhost` with a restricted, low-quota dev key only. A token-vending service must replace this approach before any public demo.

If you use ngrok to generate a public URL, please update the `vite.config.js` file after running the `ngrok http 5173` command.


## Setup

### 1. Create your env file

Copy the example file and put your Gemini API key in it:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Run the dev server

```bash
pnpm dev
```

### 4. Open the app

Open <http://localhost:5173> in Chrome (recommended) or another modern browser.

When you tap **Start**, the browser will ask for two permissions:

- **Microphone** — required, so the assistant can hear you.
- **Location** — required for "what's nearest to me" questions to work.

Grant both, then start talking. See [example-conversation.md](./example-conversation.md) for sample interactions.

## Scripts

```bash
pnpm dev         # vite dev server
pnpm typecheck   # tsc --noEmit
pnpm build       # tsc -b && vite build
pnpm preview     # preview production build
pnpm lint
pnpm format
```

## Controls

| Input | Action |
|---|---|
| Tap anywhere in the main area | Start / stop listening |
| Swipe down | Stop assistant speech |
| Swipe up | Repeat the last response |
| Two-finger tap | Open help |

## Stack

React 19, Vite 7, TypeScript, Tailwind v4, shadcn/ui, `@google/genai` (Gemini Live API), `vite-plugin-pwa`. Mic capture via `AudioWorklet` (16 kHz PCM16); playback via queued `AudioBufferSourceNode` (24 kHz).
