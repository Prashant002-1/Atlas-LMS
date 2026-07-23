"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import {
  encodeTranscriptionWav,
  MAX_TRANSCRIPTION_RECORDING_SECONDS,
} from "@/lib/audio/transcription-wav";
import { cn } from "@/lib/utils";

export type VoiceTranscriptionState = "idle" | "requesting" | "recording" | "transcribing";

const MAX_RECORDING_SECONDS = MAX_TRANSCRIPTION_RECORDING_SECONDS;
const MAX_RECORDING_MS = MAX_RECORDING_SECONDS * 1000;
const COUNTDOWN_SECONDS = 30;

export function VoiceTranscriptionButton({
  onError,
  onStateChange,
}: {
  onError?: (message: string | null) => void;
  onStateChange?: (state: VoiceTranscriptionState) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const phaseRef = useRef<VoiceTranscriptionState>("idle");
  const discardRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const [phase, setPhase] = useState<VoiceTranscriptionState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  function updatePhase(next: VoiceTranscriptionState) {
    phaseRef.current = next;
    if (mountedRef.current) setPhase(next);
    onStateChange?.(next);
  }

  function clearTimers() {
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current);
    if (elapsedTimerRef.current !== null) window.clearInterval(elapsedTimerRef.current);
    stopTimerRef.current = null;
    elapsedTimerRef.current = null;
  }

  function releaseMicrophone() {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
  }

  function reportError(message: string) {
    clearTimers();
    releaseMicrophone();
    updatePhase("idle");
    onError?.(message);
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    clearTimers();
    updatePhase("transcribing");
    recorder.stop();
  }

  async function startRecording() {
    if (phaseRef.current !== "idle") return;
    onError?.(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      reportError("Voice recording is not supported in this browser.");
      return;
    }

    updatePhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      if (!mountedRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      const recorder = new MediaRecorder(stream, { audioBitsPerSecond: 64_000 });
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRef.current = false;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("error", () => {
        discardRef.current = true;
        clearTimers();
        releaseMicrophone();
        updatePhase("transcribing");
        onError?.("The recording stopped unexpectedly. Try again.");
      });
      recorder.addEventListener("stop", () => {
        const recording = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        recorderRef.current = null;
        releaseMicrophone();
        if (discardRef.current) {
          discardRef.current = false;
          updatePhase("idle");
          return;
        }
        void transcribeRecording(recording);
      });

      recorder.start(1000);
      setElapsedSeconds(0);
      updatePhase("recording");
      elapsedTimerRef.current = window.setInterval(() => {
        if (mountedRef.current) setElapsedSeconds((current) => current + 1);
      }, 1000);
      stopTimerRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        reportError("Allow microphone access to use voice input.");
      } else if (name === "NotFoundError") {
        reportError("No microphone was found.");
      } else {
        reportError("The microphone could not start. Try again.");
      }
    }
  }

  async function transcribeRecording(recording: Blob) {
    try {
      if (recording.size === 0) throw new Error("The recording was empty.");
      const wav = await recordingToWav(recording);
      const formData = new FormData();
      formData.append("audio", wav, "recording.wav");
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch("/api/transcription", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const body = await readTranscriptionResponse(response);
      if (!response.ok) throw new Error(body.error || "Voice transcription could not finish.");
      if (!body.transcript) throw new Error("No speech was detected.");
      if (!mountedRef.current) return;

      insertTranscript(buttonRef.current?.form ?? null, body.transcript);
      onError?.(null);
      updatePhase("idle");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      reportError(error instanceof Error ? error.message : "Voice transcription could not finish. Try again.");
    } finally {
      abortRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearTimers();
      discardRef.current = true;
      abortRef.current?.abort();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      releaseMicrophone();
    };
  }, []);

  const recording = phase === "recording";
  const waiting = phase === "requesting" || phase === "transcribing";
  const remainingSeconds = Math.max(0, MAX_RECORDING_SECONDS - elapsedSeconds);
  const endingSoon = recording && remainingSeconds <= COUNTDOWN_SECONDS;
  const label = recording
    ? endingSoon
      ? `Stop voice recording, ${remainingSeconds} seconds remaining`
      : "Stop voice recording"
    : phase === "requesting"
      ? "Waiting for microphone permission"
      : phase === "transcribing"
        ? "Transcribing voice"
        : "Record voice input";

  return (
    <PromptInputButton
      ref={buttonRef}
      onClick={recording ? stopRecording : startRecording}
      disabled={waiting}
      aria-label={label}
      aria-pressed={recording}
      title={label}
      className={cn(
        "shrink-0 justify-center rounded-full px-0",
        recording
          ? cn(
              "h-9 w-auto min-w-14 gap-2 bg-[color-mix(in_oklch,var(--color-danger)_10%,transparent)] px-2.5 text-[var(--color-danger)] hover:bg-[color-mix(in_oklch,var(--color-danger)_16%,transparent)] hover:text-[var(--color-danger)]",
              endingSoon && "border border-[color-mix(in_oklch,var(--color-danger)_32%,transparent)]"
            )
          : "size-9"
      )}
    >
      {recording ? (
        <>
          <Square size={12} fill="currentColor" aria-hidden />
          <span className="atlas-mono text-[0.6875rem] tabular-nums">
            {endingSoon ? `-${formatElapsed(remainingSeconds)}` : formatElapsed(elapsedSeconds)}
          </span>
        </>
      ) : waiting ? (
        <Loader2 size={15} className="animate-spin" aria-hidden />
      ) : (
        <Mic size={15} aria-hidden />
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {recording ? "Recording. Press again to stop." : phase === "transcribing" ? "Transcribing recording." : ""}
      </span>
    </PromptInputButton>
  );
}

async function recordingToWav(recording: Blob): Promise<Blob> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await recording.arrayBuffer());
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    const wav = encodeTranscriptionWav(channels, decoded.sampleRate);
    return new Blob([new Uint8Array(wav)], { type: "audio/wav" });
  } finally {
    await context.close();
  }
}

async function readTranscriptionResponse(response: Response): Promise<{ transcript?: string; error?: string }> {
  try {
    const body = await response.json() as { transcript?: unknown; error?: unknown };
    return {
      transcript: typeof body.transcript === "string" ? body.transcript : undefined,
      error: typeof body.error === "string" ? body.error : undefined,
    };
  } catch {
    return {};
  }
}

function insertTranscript(form: HTMLFormElement | null, transcript: string) {
  const field = form?.elements.namedItem("message");
  if (!(field instanceof HTMLTextAreaElement)) return;

  const separator = field.value && !/\s$/.test(field.value) ? " " : "";
  const nextValue = `${field.value}${separator}${transcript}`;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) setter.call(field, nextValue);
  else field.value = nextValue;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.style.height = "auto";
  field.style.height = `${Math.min(field.scrollHeight, 200)}px`;
  field.setSelectionRange(nextValue.length, nextValue.length);
  field.focus();
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
