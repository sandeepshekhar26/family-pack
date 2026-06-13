// Self-contained pure functions for Chhota Cousin to break.
export function needsObj(o: { a: number }): string {
  // Throws when `o` has no numeric `a` (e.g. {}, null-proto, circular).
  return o.a.toFixed(2);
}

export function safeAdd(a: number, b: number): number {
  return a + b;
}
