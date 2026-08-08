/**
 * Resolve an unplaced assignment to the week containing its due date.
 *
 * A due date before the first dated module belongs to the first module. A due
 * date after the final opening belongs to the final module. Without a due date
 * or dated modules, the assignment remains unassigned.
 */
export function inferModuleIdFromDueDate<Module extends { id: string; opensAt: Date | null }>(
  modules: Module[],
  dueAt: Date | null | undefined
): string | null {
  if (!dueAt) return null;
  const dated = modules
    .filter((module): module is Module & { opensAt: Date } => module.opensAt !== null)
    .sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime());
  if (dated.length === 0) return null;

  let target = dated[0];
  for (const courseModule of dated) {
    if (courseModule.opensAt.getTime() <= dueAt.getTime()) target = courseModule;
    else break;
  }
  return target.id;
}
