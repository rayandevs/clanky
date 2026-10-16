/** A missing historical snapshot must never reveal a possibly anonymous author. */
export function isSuggestionAnonymous(snapshot: boolean | null | undefined): boolean {
  return snapshot ?? true;
}
