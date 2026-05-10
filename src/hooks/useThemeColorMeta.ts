import { useEffect } from "react"

const DARK_BG = "#0a0a0a"
const LIGHT_BG = "#ffffff"

/**
 * Keeps the document's <meta name="theme-color"> in sync with the resolved
 * theme so the iOS Safari status bar (and Android Chrome's chrome) match
 * the page background instead of staying white.
 *
 * Watches the `dark` class on <html> set by ThemeProvider so it works for
 * both manual light/dark and system-follow modes.
 */
export function useThemeColorMeta() {
  useEffect(() => {
    if (typeof document === "undefined") return

    function setMetaColor(color: string) {
      // Remove any media-scoped tags from index.html so our manual one wins.
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((node) => node.parentNode?.removeChild(node))
      const meta = document.createElement("meta")
      meta.name = "theme-color"
      meta.content = color
      document.head.appendChild(meta)
    }

    function apply() {
      const isDark = document.documentElement.classList.contains("dark")
      setMetaColor(isDark ? DARK_BG : LIGHT_BG)
    }

    apply()

    const observer = new MutationObserver(apply)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])
}
