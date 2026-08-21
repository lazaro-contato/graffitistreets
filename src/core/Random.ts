/**
 * Small seeded PRNG (mulberry32).
 *
 * Anything drawn from a stroke journal must be reproducible: repainting a panel
 * after an undo has to rebuild the exact same surface it had before, otherwise
 * the concrete grain visibly reshuffles under the surviving paint.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
