const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function withModuleContext(href: string, moduleId: string): string {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}fromModule=${encodeURIComponent(moduleId)}`;
}

export function moduleReturnHref(moduleId: string | undefined): string | null {
  return moduleId && UUID.test(moduleId) ? `/teach/week/${moduleId}` : null;
}
