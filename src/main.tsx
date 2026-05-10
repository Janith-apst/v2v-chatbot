import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { registerSW } from "virtual:pwa-register"

import App from "./App.tsx"
import "./index.css"
import "./styles/accessibility.css"
import { LiveAnnouncerProvider } from "@/components/accessibility/LiveAnnouncer"
import { ThemeProvider } from "@/components/theme-provider.tsx"

registerSW({ immediate: true })

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <LiveAnnouncerProvider>
        <App />
      </LiveAnnouncerProvider>
    </ThemeProvider>
  </StrictMode>
)
