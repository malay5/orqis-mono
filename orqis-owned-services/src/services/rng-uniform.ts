/**
 * rng-uniform — utility (non-AI) agent.
 * Seeded uniform random number generator. No API costs, runs in-process.
 *
 * Uses Mulberry32 — a small, fast, decent-quality 32-bit PRNG. Same input
 * `seed` always produces the same output sequence (handy for reproducible
 * test fixtures and demos). When no seed is passed, we generate one from
 * `randomBytes(4)` and return it in the response so the caller can replay
 * the same draw later.
 */

import { randomBytes } from "node:crypto";

export type RngUniformInput = {
  count: number;
  min?: number;
  max?: number;
  integer?: boolean;
  seed?: number;
};

export type RngUniformResult = {
  numbers: number[];
  count: number;
  min: number;
  max: number;
  integer: boolean;
  seed: number; // the seed that was actually used (echoed back so callers can replay)
  durationMs: number;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const RNG_UNIFORM_LIMITS = {
  maxCount: 100_000,
};

export function runRngUniform(input: RngUniformInput): RngUniformResult {
  const startedAt = performance.now();
  const count = Math.max(0, Math.min(RNG_UNIFORM_LIMITS.maxCount, Math.floor(input.count)));
  const min = input.min ?? 0;
  const max = input.max ?? 1;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error("min and max must be finite numbers");
  }
  if (max <= min) {
    throw new Error(`max (${max}) must be greater than min (${min})`);
  }
  const integer = input.integer === true;
  const seed =
    typeof input.seed === "number" && Number.isFinite(input.seed)
      ? Math.floor(input.seed) >>> 0
      : randomBytes(4).readUInt32LE(0);

  const rand = mulberry32(seed);
  const numbers: number[] = new Array(count);
  if (integer) {
    // Inclusive on both ends for integer mode (more intuitive than half-open).
    const span = Math.floor(max) - Math.ceil(min) + 1;
    const lo = Math.ceil(min);
    if (span <= 0) {
      throw new Error(`No integer values exist between min=${min} and max=${max}`);
    }
    for (let i = 0; i < count; i++) {
      numbers[i] = lo + Math.floor(rand() * span);
    }
  } else {
    const span = max - min;
    for (let i = 0; i < count; i++) {
      numbers[i] = min + rand() * span;
    }
  }

  return {
    numbers,
    count,
    min,
    max,
    integer,
    seed,
    durationMs: Math.round((performance.now() - startedAt) * 1000) / 1000,
  };
}
