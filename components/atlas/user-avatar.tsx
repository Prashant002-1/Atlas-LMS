type UserAvatarProps = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: "sm" | "lg";
};

export function UserAvatar({ name, email, image, size = "sm" }: UserAvatarProps) {
  const label = name?.trim() || email?.trim() || "Account";
  const initials = label
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sizeClass = size === "lg" ? "size-16 text-[1rem]" : "size-8 text-[0.75rem]";

  return (
    <span
      role="img"
      aria-label={`${label} profile photo`}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-indigo-soft)] font-semibold text-[var(--color-accent-strong)] ${sizeClass}`}
    >
      {initials}
      {image ? (
        <span
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${JSON.stringify(image)})` }}
        />
      ) : null}
    </span>
  );
}
