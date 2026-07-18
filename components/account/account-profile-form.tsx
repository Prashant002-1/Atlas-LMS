"use client";

import { useActionState } from "react";
import { updateAccountProfile, type AccountProfileState } from "@/lib/auth/actions";
import { ActionButton } from "@/components/atlas/primitives";
import { UserAvatar } from "@/components/atlas/user-avatar";

const initialState: AccountProfileState = {};

export type InstructorProfileFields = {
  title: string | null;
  officeLocation: string | null;
  officeHours: string | null;
};

export function AccountProfileForm({
  name,
  email,
  image,
  instructor,
}: {
  name: string;
  email: string;
  image?: string | null;
  /** Present for instructor-like accounts: title, office, office hours. */
  instructor?: InstructorProfileFields | null;
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
        {instructor ? (
          <>
            <label className="grid gap-1.5 text-[0.75rem] font-medium">
              Title
              <input
                name="title"
                type="text"
                maxLength={120}
                placeholder="Professor of Economics"
                defaultValue={instructor.title ?? ""}
                className={field}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                Office location
                <input
                  name="officeLocation"
                  type="text"
                  maxLength={160}
                  placeholder="Hayes Hall 210"
                  defaultValue={instructor.officeLocation ?? ""}
                  className={field}
                />
              </label>
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                Office hours
                <input
                  name="officeHours"
                  type="text"
                  maxLength={240}
                  placeholder="Tue and Thu, 2:00-3:30 pm"
                  defaultValue={instructor.officeHours ?? ""}
                  className={field}
                />
              </label>
            </div>
          </>
        ) : null}
        {state.error ? <p role="alert" className="text-[0.75rem] text-[var(--color-danger)]">{state.error}</p> : null}
        <div>
          <ActionButton>Save profile</ActionButton>
        </div>
      </div>
    </form>
  );
}
