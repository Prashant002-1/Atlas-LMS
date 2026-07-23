export const TRANSCRIPTION_SAMPLE_RATE = 16_000;
export const MAX_TRANSCRIPTION_RECORDING_SECONDS = 10 * 60;

/** Downmix browser-decoded audio and encode it as Gemini-supported mono PCM WAV. */
export function encodeTranscriptionWav(
  channels: readonly Float32Array[],
  sourceSampleRate: number
): Uint8Array {
  if (channels.length === 0 || channels[0].length === 0) {
    throw new Error("The recording did not contain audio samples.");
  }
  if (!Number.isFinite(sourceSampleRate) || sourceSampleRate <= 0) {
    throw new Error("The recording sample rate is invalid.");
  }

  const sourceLength = Math.min(...channels.map((channel) => channel.length));
  const mono = new Float32Array(sourceLength);
  for (const channel of channels) {
    for (let index = 0; index < sourceLength; index += 1) {
      mono[index] += channel[index] / channels.length;
    }
  }

  const resampled = resampleLinear(mono, sourceSampleRate, TRANSCRIPTION_SAMPLE_RATE);
  const samples = resampled.subarray(0, MAX_TRANSCRIPTION_RECORDING_SECONDS * TRANSCRIPTION_SAMPLE_RATE);
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TRANSCRIPTION_SAMPLE_RATE, true);
  view.setUint32(28, TRANSCRIPTION_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return bytes;
}

function resampleLinear(samples: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) return samples;

  const targetLength = Math.max(1, Math.round(samples.length * targetRate / sourceRate));
  const output = new Float32Array(targetLength);
  const scale = sourceRate / targetRate;

  for (let index = 0; index < targetLength; index += 1) {
    const sourcePosition = index * scale;
    const left = Math.min(samples.length - 1, Math.floor(sourcePosition));
    const right = Math.min(samples.length - 1, left + 1);
    const mix = sourcePosition - left;
    output[index] = samples[left] * (1 - mix) + samples[right] * mix;
  }

  return output;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
