export function allowedLoginEmails(value = process.env.ATLAS_ALLOWED_LOGIN_EMAILS): Set<string> | null {
  if (!value?.trim()) return null;

  const emails = value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return new Set(emails);
}

export function isLoginEmailAllowed(
  email: string,
  value = process.env.ATLAS_ALLOWED_LOGIN_EMAILS
): boolean {
  const allowlist = allowedLoginEmails(value);
  return allowlist === null || allowlist.has(email.trim().toLowerCase());
}
