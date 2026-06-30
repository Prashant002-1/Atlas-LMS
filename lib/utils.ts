import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * The shadcn class merge helper: compose conditional class names (clsx) and
 * resolve Tailwind conflicts (tailwind-merge) so the last utility wins.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
