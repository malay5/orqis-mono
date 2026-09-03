/**
 * sort-bench — utility (non-AI) agent.
 *
 * Sort an array of numbers with one of six classic algorithms (plus the
 * runtime's native sort for comparison). Returns the sorted output along
 * with measured comparisons + swaps + wall-clock time.
 *
 * Educational use case: pick "bubble" on a 1000-element array and watch
 * the comparison/swap count blow up next to "merge" on the same input.
 */

export type SortAlgorithm =
  | "bubble"
  | "insertion"
  | "selection"
  | "merge"
  | "quick"
  | "heap"
  | "native";

export type SortBenchInput = {
  numbers: number[];
  algorithm?: SortAlgorithm;
  reverse?: boolean;
};

export type SortBenchResult = {
  sorted: number[];
  algorithmUsed: SortAlgorithm;
  comparisons: number;
  swaps: number;
  durationMs: number;
  reversed: boolean;
};

export const SORT_BENCH_LIMITS = {
  maxLength: 50_000,
};

type Counters = { comparisons: number; swaps: number };

function cmp(a: number, b: number, c: Counters): number {
  c.comparisons++;
  return a - b;
}

function swap(arr: number[], i: number, j: number, c: Counters): void {
  if (i === j) return;
  const t = arr[i];
  arr[i] = arr[j];
  arr[j] = t;
  c.swaps++;
}

function bubbleSort(arr: number[], c: Counters): void {
  let n = arr.length;
  let swapped = true;
  while (swapped) {
    swapped = false;
    for (let i = 1; i < n; i++) {
      if (cmp(arr[i - 1], arr[i], c) > 0) {
        swap(arr, i - 1, i, c);
        swapped = true;
      }
    }
    n--;
  }
}

function insertionSort(arr: number[], c: Counters): void {
  for (let i = 1; i < arr.length; i++) {
    let j = i;
    while (j > 0 && cmp(arr[j - 1], arr[j], c) > 0) {
      swap(arr, j - 1, j, c);
      j--;
    }
  }
}

function selectionSort(arr: number[], c: Counters): void {
  for (let i = 0; i < arr.length; i++) {
    let minIdx = i;
    for (let j = i + 1; j < arr.length; j++) {
      if (cmp(arr[j], arr[minIdx], c) < 0) minIdx = j;
    }
    if (minIdx !== i) swap(arr, i, minIdx, c);
  }
}

function mergeSort(arr: number[], c: Counters): void {
  const n = arr.length;
  if (n < 2) return;
  // Iterative bottom-up so we don't blow the call stack on large inputs.
  const buf = new Array<number>(n);
  for (let width = 1; width < n; width *= 2) {
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width, n);
      const hi = Math.min(lo + 2 * width, n);
      let i = lo;
      let j = mid;
      let k = lo;
      while (i < mid && j < hi) {
        if (cmp(arr[i], arr[j], c) <= 0) buf[k++] = arr[i++];
        else buf[k++] = arr[j++];
      }
      while (i < mid) buf[k++] = arr[i++];
      while (j < hi) buf[k++] = arr[j++];
      for (let p = lo; p < hi; p++) {
        if (arr[p] !== buf[p]) {
          arr[p] = buf[p];
          c.swaps++;
        }
      }
    }
  }
}

function quickSort(arr: number[], c: Counters): void {
  // Iterative with explicit stack — avoids stack overflow on degenerate inputs.
  const stack: [number, number][] = [[0, arr.length - 1]];
  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!;
    if (lo >= hi) continue;
    // Median-of-three pivot to mitigate worst-case on already-sorted input.
    const mid = (lo + hi) >>> 1;
    if (cmp(arr[lo], arr[mid], c) > 0) swap(arr, lo, mid, c);
    if (cmp(arr[lo], arr[hi], c) > 0) swap(arr, lo, hi, c);
    if (cmp(arr[mid], arr[hi], c) > 0) swap(arr, mid, hi, c);
    swap(arr, mid, hi - 1, c);
    const pivot = arr[hi - 1];
    let i = lo;
    let j = hi - 1;
    while (true) {
      do {
        i++;
      } while (cmp(arr[i], pivot, c) < 0);
      do {
        j--;
      } while (cmp(arr[j], pivot, c) > 0);
      if (i >= j) break;
      swap(arr, i, j, c);
    }
    swap(arr, i, hi - 1, c);
    stack.push([lo, i - 1]);
    stack.push([i + 1, hi]);
  }
}

function heapSort(arr: number[], c: Counters): void {
  const n = arr.length;
  const siftDown = (start: number, end: number) => {
    let root = start;
    while (root * 2 + 1 <= end) {
      const child = root * 2 + 1;
      let swapIdx = root;
      if (cmp(arr[swapIdx], arr[child], c) < 0) swapIdx = child;
      if (child + 1 <= end && cmp(arr[swapIdx], arr[child + 1], c) < 0) swapIdx = child + 1;
      if (swapIdx === root) return;
      swap(arr, root, swapIdx, c);
      root = swapIdx;
    }
  };
  // Heapify
  for (let start = (n - 2) >> 1; start >= 0; start--) siftDown(start, n - 1);
  // Sort
  for (let end = n - 1; end > 0; end--) {
    swap(arr, 0, end, c);
    siftDown(0, end - 1);
  }
}

const ALGORITHMS: Record<Exclude<SortAlgorithm, "native">, (a: number[], c: Counters) => void> = {
  bubble: bubbleSort,
  insertion: insertionSort,
  selection: selectionSort,
  merge: mergeSort,
  quick: quickSort,
  heap: heapSort,
};

export function runSortBench(input: SortBenchInput): SortBenchResult {
  if (!Array.isArray(input.numbers)) {
    throw new Error("`numbers` must be an array");
  }
  if (input.numbers.length > SORT_BENCH_LIMITS.maxLength) {
    throw new Error(
      `numbers.length (${input.numbers.length}) exceeds the cap of ${SORT_BENCH_LIMITS.maxLength}`
    );
  }
  for (let i = 0; i < input.numbers.length; i++) {
    if (typeof input.numbers[i] !== "number" || !Number.isFinite(input.numbers[i])) {
      throw new Error(`numbers[${i}] is not a finite number`);
    }
  }

  const algorithm: SortAlgorithm = input.algorithm ?? "merge";
  const arr = input.numbers.slice();
  const counters: Counters = { comparisons: 0, swaps: 0 };
  const startedAt = performance.now();

  if (algorithm === "native") {
    // Counters are meaningless for the engine's native sort; report 0/0 to
    // make the difference vs the educational implementations explicit.
    arr.sort((a, b) => a - b);
  } else {
    const fn = ALGORITHMS[algorithm];
    if (!fn) throw new Error(`Unknown algorithm: ${algorithm}`);
    fn(arr, counters);
  }

  if (input.reverse) arr.reverse();
  const durationMs = Math.round((performance.now() - startedAt) * 1000) / 1000;

  return {
    sorted: arr,
    algorithmUsed: algorithm,
    comparisons: counters.comparisons,
    swaps: counters.swaps,
    durationMs,
    reversed: input.reverse === true,
  };
}
