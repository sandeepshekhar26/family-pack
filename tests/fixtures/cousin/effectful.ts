// Effectful target — Chhota Cousin must SKIP this (no auto-execution).
import * as fs from 'fs';

export function persist(name: string): void {
  fs.writeFileSync('/tmp/family-pack-should-not-run', name);
}
