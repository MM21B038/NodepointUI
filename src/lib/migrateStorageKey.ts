/** Copy a legacy localStorage value to a new key once, then remove the legacy key. */
export function readMigratedLocalStorage(
  currentKey: string,
  legacyKey: string
): string | null {
  try {
    const current = localStorage.getItem(currentKey);
    if (current !== null) return current;
    const legacy = localStorage.getItem(legacyKey);
    if (legacy === null) return null;
    localStorage.setItem(currentKey, legacy);
    localStorage.removeItem(legacyKey);
    return legacy;
  } catch {
    return null;
  }
}
