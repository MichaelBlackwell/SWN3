/**
 * Returns a user-facing system name with trailing "System" removed.
 */
export function getSystemDisplayName(name: string): string {
  return name.replace(/\s+system$/i, '').trim();
}



