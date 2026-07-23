import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isRetryableError } from "@/lib/ai/provider";
import { isTranscriptionConfigured, transcribeAudio } from "@/lib/ai/transcription";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 64 * 1024;
const MAX_TRANSCRIPT_CHARACTERS = 4000;
const SUPPORTED_AUDIO_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave"]);

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId) {
    return NextResponse.json({ error: "Sign in to use voice input." }, { status: 401 });
  }
  if (!isTranscriptionConfigured()) {
    return NextResponse.json({ error: "Voice transcription is not configured." }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "That recording is too large." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "That recording could not be read." }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size <= 44) {
    return NextResponse.json({ error: "Record some speech first." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "That recording is too large." }, { status: 413 });
  }

  const mediaType = audio.type.toLowerCase().split(";", 1)[0];
  if (!SUPPORTED_AUDIO_TYPES.has(mediaType)) {
    return NextResponse.json({ error: "That audio format is not supported." }, { status: 415 });
  }

  try {
    const transcript = await transcribeAudio({
      audio: new Uint8Array(await audio.arrayBuffer()),
      mediaType,
    });
    if (!transcript) {
      return NextResponse.json({ error: "No speech was detected." }, { status: 422 });
    }
    if (transcript.length > MAX_TRANSCRIPT_CHARACTERS) {
      return NextResponse.json({ error: "That recording produced too much text. Try a shorter recording." }, { status: 422 });
    }
    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("Voice transcription failed", error);
    if (isRetryableError(error)) {
      return NextResponse.json(
        { error: "Voice transcription is busy. Try again in a moment." },
        { status: 503, headers: { "Retry-After": "5" } }
      );
    }
    return NextResponse.json({ error: "Voice transcription could not finish. Try again." }, { status: 502 });
  }
}
