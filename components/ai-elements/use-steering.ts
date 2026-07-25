"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UIMessage } from "ai";

/**
 * Client half of steering: redirect a response that is already streaming
 * rather than lining a message up behind it.
 *
 * The note leaves for the server the moment it is typed, addressed to the run
 * that owns the turn, and that run injects it at its next step boundary. What
 * this hook tracks is only the gap between sending and the run confirming it,
 * which the UI shows so the professor knows whether Atlas has the redirection
 * yet.
 *
 * Two fallbacks keep typed text from disappearing. If the server says nothing
 * is in flight, the text becomes an ordinary turn. And if the run ends without
 * ever reaching a boundary, which is the single-step case with nothing left to
 * redirect, whatever went unconfirmed is sent as the next turn instead.
 */

type LoosePart = { type?: unknown; data?: unknown } & Record<string, unknown>;

export type SteeringNote = { id: string; text: string; applied: boolean };

export function useSteering(args: {
  /** Null while a fresh chat has not learned its id yet. */
  threadId: string | null;
  messages: UIMessage[];
  /** Send as a normal turn: used when there is nothing to redirect. */
  sendAsTurn: (text: string) => void;
}) {
  const [notes, setNotes] = useState<SteeringNote[]>([]);
  const notesRef = useRef<SteeringNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const threadIdRef = useRef<string | null>(args.threadId);
  const sendAsTurnRef = useRef(args.sendAsTurn);

  useEffect(() => {
    threadIdRef.current = args.threadId;
    sendAsTurnRef.current = args.sendAsTurn;
  }, [args.sendAsTurn, args.threadId]);

  const track = useCallback((next: SteeringNote[]) => {
    notesRef.current = next;
    setNotes(next);
  }, []);

  /* The run reports the boundary where a redirection reached the model. */
  const appliedTexts = useMemo(() => {
    const applied = new Set<string>();
    for (const message of args.messages.slice(-6)) {
      for (const part of (message.parts ?? []) as LoosePart[]) {
        if (part.type !== "data-steering-applied") continue;
        const data = part.data as { notes?: unknown } | undefined;
        if (!Array.isArray(data?.notes)) continue;
        for (const note of data.notes) if (typeof note === "string") applied.add(note);
      }
    }
    return applied;
  }, [args.messages]);

  useEffect(() => {
    if (appliedTexts.size === 0) return;
    const current = notesRef.current;
    const next = current.map((note) => (note.applied || !appliedTexts.has(note.text) ? note : { ...note, applied: true }));
    if (next.some((note, index) => note.applied !== current[index]?.applied)) track(next);
  }, [appliedTexts, track]);

  const steer = useCallback(
    async (text: string) => {
      const threadId = threadIdRef.current;
      /* Nothing to address a note to yet, so this is just the first turn. */
      if (!threadId || threadId === "new") {
        sendAsTurnRef.current(text);
        return;
      }
      const optimistic: SteeringNote = { id: `local:${Date.now()}:${notesRef.current.length}`, text, applied: false };
      track([...notesRef.current, optimistic]);
      setError(null);

      const drop = () => track(notesRef.current.filter((note) => note.id !== optimistic.id));
      try {
        const response = await fetch("/api/atlas/steer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: threadId, text }),
        });
        if (response.ok) return;
        drop();
        if (response.status === 409) {
          /* No run in flight, so the text is simply the next turn. */
          sendAsTurnRef.current(text);
          return;
        }
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Atlas could not take that redirection.");
      } catch {
        drop();
        setError("Atlas could not take that redirection.");
      }
    },
    [track]
  );

  /**
   * Call when a run finishes. Anything the run never reached is sent as the
   * next turn, so a redirection typed too late still gets answered.
   */
  const settleAfterRun = useCallback(() => {
    const unreached = notesRef.current.filter((note) => !note.applied);
    track([]);
    setError(null);
    if (unreached.length === 0) return;
    const text = unreached.map((note) => note.text).join("\n\n");
    window.setTimeout(() => sendAsTurnRef.current(text), 0);
  }, [track]);

  return { notes, error, steer, settleAfterRun };
}
