// AudioWorkletProcessor that forwards mono input frames to the main thread.
// Runs on the audio rendering thread, so it must be tiny and allocation-light.
// The main thread is responsible for batching, downsampling, and PCM16 conversion.

class MicProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const channel = input[0]
    if (!channel || channel.length === 0) return true
    // Copy because the underlying buffer is reused by the audio thread.
    const copy = new Float32Array(channel.length)
    copy.set(channel)
    this.port.postMessage(copy, [copy.buffer])
    return true
  }
}

registerProcessor("mic-processor", MicProcessor)
