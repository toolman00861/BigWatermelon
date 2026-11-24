import { mergeRate } from "@/lib/fruits";

export class MergeAudio {
  private context: AudioContext | null = null;
  private custom: AudioBuffer | null = null;
  private fallback: AudioBuffer | null = null;

  private async contextReady() {
    if (!this.context) {
      this.context = new AudioContext();
      this.fallback = createPop(this.context);
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    return this.context;
  }

  async unlock() {
    await this.contextReady();
  }

  async useCustom(data: ArrayBuffer) {
    const context = await this.contextReady();
    this.custom = await context.decodeAudioData(data.slice(0));
  }

  clearCustom() {
    this.custom = null;
  }

  play(resultKind: number) {
    const context = this.context;
    const buffer = this.custom ?? this.fallback;
    if (!context || !buffer) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = mergeRate(resultKind);
    const gain = context.createGain();
    gain.gain.value = 0.45;
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
  }
}

function createPop(context: AudioContext) {
  const rate = context.sampleRate;
  const length = Math.floor(rate * 0.28);
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const t = i / rate;
    const envelope = Math.exp(-t * 12);
    const tone =
      Math.sin(2 * Math.PI * 540 * t) +
      0.4 * Math.sin(2 * Math.PI * 810 * t);
    data[i] = tone * envelope * 0.35;
  }
  return buffer;
}
