import { int16ToFloat32 } from "./pcm16"

const OUTPUT_RATE = 24000
// Memory cap on the snapshot used by replayLastTurn (~2.9 MB).
const MAX_SNAPSHOT_SAMPLES = OUTPUT_RATE * 60

export class AudioPlayer {
  private audioContext: AudioContext | null = null
  private nextStartTime = 0
  private activeSources = new Set<AudioBufferSourceNode>()
  private playing = false
  private playbackRate = 1
  // PCM16 chunks for the turn currently being received.
  private currentTurnChunks: Int16Array[] = []
  private currentTurnSamples = 0
  // Last fully-received turn, kept for replayLastTurn().
  private lastTurnSnapshot: Int16Array | null = null
  // Analyser sits between sources and the destination so the UI can
  // visualize what the user actually hears.
  private analyser: AnalyserNode | null = null
  // Fires when the last queued source finishes (or after a flush), so the
  // orchestrator can leave the "speaking" state at the right moment instead
  // of guessing from turnComplete (which arrives well before playback ends
  // since we schedule chunks into the future).
  private onPlaybackEnd: (() => void) | null = null

  isPlaying(): boolean {
    return this.playing
  }

  setOnPlaybackEnd(handler: (() => void) | null): void {
    this.onPlaybackEnd = handler
  }

  hasLastTurn(): boolean {
    return this.lastTurnSnapshot !== null && this.lastTurnSnapshot.length > 0
  }

  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) return
    this.playbackRate = rate
    for (const source of this.activeSources) {
      try {
        source.playbackRate.value = rate
      } catch {
        // ignore
      }
    }
  }

  startTurn(): void {
    this.currentTurnChunks = []
    this.currentTurnSamples = 0
  }

  endTurn(): void {
    if (this.currentTurnSamples === 0) {
      // No audio for this turn; leave the previous snapshot intact.
      return
    }
    const merged = new Int16Array(this.currentTurnSamples)
    let offset = 0
    for (const chunk of this.currentTurnChunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    this.lastTurnSnapshot = merged
    this.currentTurnChunks = []
    this.currentTurnSamples = 0
  }

  private ensureContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new AudioContext({ sampleRate: OUTPUT_RATE })
      this.nextStartTime = this.audioContext.currentTime
      this.analyser = this.audioContext.createAnalyser()
      // Smaller FFT updates more often, which matters because each scheduled
      // AudioBufferSourceNode is short. Higher smoothing keeps bars lively
      // instead of flickering between near-zero values between buffers.
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.6
      this.analyser.minDecibels = -90
      this.analyser.maxDecibels = -10
      this.analyser.connect(this.audioContext.destination)
    }
    if (this.audioContext.state === "suspended") {
      void this.audioContext.resume()
    }
    return this.audioContext
  }

  /**
   * Returns the current AnalyserNode if one exists, null until first audio.
   * Visualizers can read time-domain or frequency data from it.
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  private playSamples(samples: Int16Array): void {
    if (samples.length === 0) return
    const ctx = this.ensureContext()

    const floats = int16ToFloat32(samples)
    const buffer = ctx.createBuffer(1, floats.length, OUTPUT_RATE)
    buffer.getChannelData(0).set(floats)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = this.playbackRate
    if (this.analyser) source.connect(this.analyser)
    else source.connect(ctx.destination)

    const startAt = Math.max(this.nextStartTime, ctx.currentTime)
    source.start(startAt)
    this.nextStartTime = startAt + buffer.duration / this.playbackRate

    this.activeSources.add(source)
    this.playing = true

    source.onended = () => {
      this.activeSources.delete(source)
      if (this.activeSources.size === 0) {
        this.playing = false
        this.onPlaybackEnd?.()
      }
    }
  }

  enqueue(pcm16: ArrayBuffer): void {
    if (pcm16.byteLength === 0) return
    const samples = new Int16Array(pcm16)

    // Snapshot for replay, bounded.
    if (this.currentTurnSamples + samples.length <= MAX_SNAPSHOT_SAMPLES) {
      // Copy because the caller's buffer may be reused.
      this.currentTurnChunks.push(new Int16Array(samples))
      this.currentTurnSamples += samples.length
    }

    this.playSamples(samples)
  }

  replayLastTurn(): boolean {
    if (!this.lastTurnSnapshot || this.lastTurnSnapshot.length === 0) {
      return false
    }
    this.flush()
    this.playSamples(this.lastTurnSnapshot)
    return true
  }

  flush(): void {
    if (!this.audioContext) return
    const wasPlaying = this.playing
    for (const source of this.activeSources) {
      try {
        source.onended = null
        source.stop()
        source.disconnect()
      } catch {
        // already stopped
      }
    }
    this.activeSources.clear()
    this.nextStartTime = this.audioContext.currentTime
    this.playing = false
    // Drop the in-flight snapshot — the user interrupted before the turn ended.
    this.currentTurnChunks = []
    this.currentTurnSamples = 0
    if (wasPlaying) this.onPlaybackEnd?.()
  }

  async stop(): Promise<void> {
    this.flush()
    this.lastTurnSnapshot = null
    if (this.audioContext) {
      try {
        await this.audioContext.close()
      } catch {
        // ignore
      }
      this.audioContext = null
      this.analyser = null
    }
  }
}
