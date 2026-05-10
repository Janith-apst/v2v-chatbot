import { downsampleFloat32, floatTo16BitPCM } from "./pcm16"

const TARGET_RATE = 16000
// ~30 ms of 16 kHz audio = 480 samples. Smaller batches mean silence (and
// therefore end-of-speech) reaches the server's VAD with much less local
// buffering tail. Trade-off is more WebSocket frames per second, which is
// fine for a single-user POC.
const BATCH_SAMPLES_AT_TARGET = 480

type ChunkHandler = (pcm16: ArrayBuffer) => void

export class MicRecorder {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private workletNode: AudioWorkletNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private buffer: Float32Array = new Float32Array(0)
  private muted = false
  private active = false

  isActive(): boolean {
    return this.active
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  async start(onChunk: ChunkHandler): Promise<void> {
    if (this.active) return

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    })

    this.audioContext = new AudioContext()
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume()
    }

    const workletUrl = new URL("./mic-worklet.js", import.meta.url)
    await this.audioContext.audioWorklet.addModule(workletUrl)

    this.sourceNode = this.audioContext.createMediaStreamSource(
      this.mediaStream
    )
    this.workletNode = new AudioWorkletNode(this.audioContext, "mic-processor")

    const fromRate = this.audioContext.sampleRate
    // Buffer enough source-rate samples so that after downsampling we have a full batch.
    const batchSamplesAtSource = Math.ceil(
      (BATCH_SAMPLES_AT_TARGET * fromRate) / TARGET_RATE
    )

    this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (this.muted) return
      const incoming = event.data
      if (!incoming || incoming.length === 0) return

      const merged = new Float32Array(this.buffer.length + incoming.length)
      merged.set(this.buffer, 0)
      merged.set(incoming, this.buffer.length)
      this.buffer = merged

      while (this.buffer.length >= batchSamplesAtSource) {
        const slice = this.buffer.subarray(0, batchSamplesAtSource)
        this.buffer = this.buffer.slice(batchSamplesAtSource)
        const downsampled = downsampleFloat32(slice, fromRate, TARGET_RATE)
        const pcm16 = floatTo16BitPCM(downsampled)
        const out = new ArrayBuffer(pcm16.byteLength)
        new Int16Array(out).set(pcm16)
        onChunk(out)
      }
    }

    this.sourceNode.connect(this.workletNode)
    // Worklet does not need to drive the destination — connecting through a
    // muted gain keeps the graph alive without producing playback.
    const sink = this.audioContext.createGain()
    sink.gain.value = 0
    this.workletNode.connect(sink)
    sink.connect(this.audioContext.destination)

    this.active = true
  }

  async stop(): Promise<void> {
    this.active = false
    this.muted = false
    this.buffer = new Float32Array(0)

    if (this.workletNode) {
      this.workletNode.port.onmessage = null
      this.workletNode.disconnect()
      this.workletNode = null
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) track.stop()
      this.mediaStream = null
    }
    if (this.audioContext) {
      try {
        await this.audioContext.close()
      } catch {
        // ignore double-close
      }
      this.audioContext = null
    }
  }
}
