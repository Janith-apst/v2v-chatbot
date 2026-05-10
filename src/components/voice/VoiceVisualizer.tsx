import { Mic, Square } from "lucide-react"
import { useEffect, useRef } from "react"

import { useReducedMotion } from "@/hooks/useReducedMotion"
import { cn } from "@/lib/utils"
import type { AssistantState } from "@/types/assistant"

type Props = {
  status: AssistantState
  /** Returns the live AnalyserNode while audio is playing, else null. */
  getAnalyser: () => AnalyserNode | null
}

const LISTEN_STATES: AssistantState[] = [
  "listening",
  "processing",
  "requesting-mic",
  "connecting",
]

const ACTIVE_STATES: AssistantState[] = [
  ...LISTEN_STATES,
  "speaking",
  "stopping",
]

// Number of frequency bars drawn around the disc. 48 looks dense enough to
// read as a continuous halo on a phone screen.
const BAR_COUNT = 48

export function VoiceVisualizer({ status, getAnalyser }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reducedMotion = useReducedMotion()
  const isSpeaking = status === "speaking"
  const isListening = LISTEN_STATES.includes(status)
  const isActive = ACTIVE_STATES.includes(status)

  useEffect(() => {
    if (!isSpeaking) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let analyser: AnalyserNode | null = null
    let freq: Uint8Array<ArrayBuffer> | null = null

    function sizeCanvas() {
      if (!canvas || !ctx) return
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      // Fall back to the container's offset size if rect is briefly zero
      // (can happen on the very first frame after the canvas mounts).
      const cssW =
        rect.width || canvas.parentElement?.clientWidth || canvas.clientWidth
      const cssH =
        rect.height ||
        canvas.parentElement?.clientHeight ||
        canvas.clientHeight
      canvas.width = Math.max(1, Math.floor(cssW * dpr))
      canvas.height = Math.max(1, Math.floor(cssH * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    sizeCanvas()
    const observer = new ResizeObserver(sizeCanvas)
    observer.observe(canvas)
    if (canvas.parentElement) observer.observe(canvas.parentElement)

    function draw(t: number) {
      if (!canvas || !ctx) return
      if (!analyser) {
        analyser = getAnalyser()
        if (analyser) freq = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
      }

      const dpr = window.devicePixelRatio || 1
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2
      // The disc the bars radiate from. Inner bound is 70% of the radius;
      // bars extend outward up to ~95%.
      const radius = Math.min(w, h) / 2
      const inner = radius * 0.55
      const maxBarLen = radius * 0.4

      const color = getComputedStyle(canvas).color || "#fff"
      ctx.strokeStyle = color
      ctx.lineCap = "round"
      ctx.lineWidth = Math.max(2, radius / 22)

      // Pull amplitudes either from the live analyser, or generate a gentle
      // placeholder oscillation so the user always sees motion.
      const amplitudes: number[] = new Array(BAR_COUNT)
      if (analyser && freq) {
        analyser.getByteFrequencyData(freq)
        // Spread a useful slice of the spectrum across the bars.
        const usable = Math.min(freq.length, 256)
        for (let i = 0; i < BAR_COUNT; i++) {
          const start = Math.floor((i / BAR_COUNT) * usable)
          const end = Math.floor(((i + 1) / BAR_COUNT) * usable)
          let sum = 0
          let n = 0
          for (let j = start; j < end; j++) {
            sum += freq[j]
            n++
          }
          amplitudes[i] = n > 0 ? sum / n / 255 : 0
        }
      } else {
        // Placeholder breathing animation while analyser comes online.
        const phase = t / 600
        for (let i = 0; i < BAR_COUNT; i++) {
          amplitudes[i] = 0.25 + 0.15 * Math.sin(phase + i * 0.4)
        }
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        const a = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2
        const len = inner + amplitudes[i] * maxBarLen
        const x1 = cx + Math.cos(a) * inner
        const y1 = cy + Math.sin(a) * inner
        const x2 = cx + Math.cos(a) * len
        const y2 = cy + Math.sin(a) * len
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [getAnalyser, isSpeaking])

  return (
    <div
      aria-hidden="true"
      className="relative flex size-56 items-center justify-center sm:size-72"
    >
      {/* Listening pulse rings */}
      {isListening && !reducedMotion && (
        <>
          <span
            className="voice-pulse absolute inset-0 rounded-full border-2 border-primary"
            style={{ animationDelay: "0s" }}
          />
          <span
            className="voice-pulse absolute inset-0 rounded-full border-2 border-primary"
            style={{ animationDelay: "0.5s" }}
          />
          <span
            className="voice-pulse absolute inset-0 rounded-full border-2 border-primary"
            style={{ animationDelay: "1s" }}
          />
        </>
      )}

      {/* Speaking halo: bars radiating outward, driven by analyser. Sits
          behind the solid disc so the disc reads as a clean shape with the
          waveform forming a halo around it. */}
      {isSpeaking && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full text-destructive"
        />
      )}

      <div
        className={cn(
          "relative z-10 flex size-32 items-center justify-center rounded-full sm:size-40",
          isActive
            ? "bg-destructive text-destructive-foreground"
            : "bg-primary text-primary-foreground"
        )}
      >
        {isSpeaking ? null : isActive ? (
          <Square className="size-12 sm:size-14" />
        ) : (
          <Mic className="size-12 sm:size-14" />
        )}
      </div>
    </div>
  )
}
