"use client";

/**
 * Reasoning is a process signal, never a disclosure surface. New runtimes do
 * not send reasoning text to the client; this compact fallback also keeps old
 * persisted reasoning parts private when historical turns are rehydrated.
 */
export function Reasoning(props: {
  children: string;
  streaming?: boolean;
}) {
  void props;
  return null;
}
