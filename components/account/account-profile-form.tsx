"use client";

import { useActionState } from "react";
import { updateAccountProfile, type AccountProfileState } from "@/lib/auth/actions";
import { ActionButton } from "@/components/atlas/primitives";
import { UserAvatar } from "@/components/atlas/user-avatar";

const initialState: AccountProfileState = {};

export function AccountProfileForm({
  name,
  email,
  image,
}: {
  name: string;
  email: string;
  image?: string | null;
}) {
  const [state, formAction] = useActionState(updateAccountProfile, initialState);
  const field =
    "min-h-10 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.875rem] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";

  return (
    <form action={formAction} className="mt-5 grid gap-5 sm:grid-cols-[4rem_minmax(0,1fr)]">
      <UserAvatar name={name} email={email} image={image} size="lg" />
      <div className="grid gap-4">
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Name
          <input name="name" type="text" required maxLength={100} defaultValue={name} className={field} />
        </label>
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Photo URL
          <input
            name="image"
            type="url"
            maxLength={2048}
            inputMode="url"
            placeholder="https://example.com/photo.jpg"
            defaultValue={image ?? ""}
            className={field}
          />
        </label>
        {state.error ? <p role="alert" className="text-[0.75rem] text-[var(--color-danger)]">{state.error}</p> : null}
        <div>
          <ActionButton>Save profile</ActionButton>
        </div>
      </div>
    </form>
  );
}
