/*
 * Sort Bench — algorithm engine.
 *
 * Every algorithm runs once, up front, against a "tracer". The tracer
 * performs the real operations on a working copy of the array and records
 * each one as a small op object. The UI then replays that op list, which
 * is what makes stepping backwards and scrubbing the timeline possible.
 *
 * Op types
 *   c  compare  {i, j}        s  swap   {i, j}
 *   w  write    {i, v}        r  read   {i}
 *   p  pivot    {i}           g  range  {lo, hi}   (active sub-array)
 *   d  done     {i}           (element is in its final position)
 * Every op may carry `l`, the pseudocode line it came from.
 */
(function (root) {
  'use strict';

  function makeTracer(input) {
    const a = input.slice();
    const n = a.length;
    const ops = [];
    const marked = new Uint8Array(n);

    return {
      a, n, ops,
      less(i, j, l) { ops.push({ t: 'c', i, j, l }); return a[i] < a[j]; },
      greater(i, j, l) { ops.push({ t: 'c', i, j, l }); return a[i] > a[j]; },
      // Compare two values that are not both in the array (merge sort's buffer).
      // i and j are the positions to highlight.
      cmpv(i, j, vi, vj, l) { ops.push({ t: 'c', i, j, l }); return vi <= vj; },
      swap(i, j, l) {
        if (i === j) return;
        ops.push({ t: 's', i, j, l });
        const x = a[i]; a[i] = a[j]; a[j] = x;
      },
      write(i, v, l) { ops.push({ t: 'w', i, v, l }); a[i] = v; },
      read(i, l) { ops.push({ t: 'r', i, l }); return a[i]; },
      pivot(i, l) { ops.push({ t: 'p', i, l }); },
      range(lo, hi) { ops.push({ t: 'g', lo, hi }); },
      done(i) {
        if (i < 0 || i >= n || marked[i]) return;
        marked[i] = 1;
        ops.push({ t: 'd', i });
      },
      // Clear highlights and sweep a "sorted" mark across whatever is left.
      finish() {
        ops.push({ t: 'g', lo: -1, hi: -1 });
        for (let i = 0; i < n; i++) this.done(i);
      },
    };
  }

  /* ---------------------------------------------------------------- */

  function bubble(t) {
    const n = t.n;
    for (let i = 0; i < n - 1; i++) {
      let swapped = false;
      for (let j = 0; j < n - i - 1; j++) {
        if (t.greater(j, j + 1, 3)) { t.swap(j, j + 1, 4); swapped = true; }
      }
      t.done(n - i - 1);
      if (!swapped) break;
    }
  }

  function cocktail(t) {
    let lo = 0, hi = t.n - 1, swapped = true;
    while (swapped && lo < hi) {
      swapped = false;
      for (let j = lo; j < hi; j++) {
        if (t.greater(j, j + 1, 2)) { t.swap(j, j + 1, 3); swapped = true; }
      }
      t.done(hi); hi--;
      if (!swapped) break;
      for (let j = hi; j > lo; j--) {
        if (t.greater(j - 1, j, 5)) { t.swap(j - 1, j, 6); swapped = true; }
      }
      t.done(lo); lo++;
    }
  }

  function selection(t) {
    const n = t.n;
    for (let i = 0; i < n - 1; i++) {
      let m = i;
      t.pivot(m, 1);
      for (let j = i + 1; j < n; j++) {
        if (t.less(j, m, 3)) { m = j; t.pivot(m, 4); }
      }
      t.swap(i, m, 5);
      t.done(i);
    }
  }

  function insertion(t) {
    for (let i = 1; i < t.n; i++) {
      let j = i;
      while (j > 0 && t.greater(j - 1, j, 2)) { t.swap(j - 1, j, 3); j--; }
    }
  }

  function shell(t) {
    const n = t.n;
    let h = 1;
    while (h < n / 3) h = 3 * h + 1; // Knuth: 1, 4, 13, 40, 121 …
    while (h >= 1) {
      for (let i = h; i < n; i++) {
        let j = i;
        while (j >= h && t.greater(j - h, j, 3)) { t.swap(j - h, j, 4); j -= h; }
      }
      h = Math.floor(h / 3);
    }
  }

  function merge(t) {
    const a = t.a;
    function sort(lo, hi) {
      if (lo >= hi) return;
      const mid = (lo + hi) >> 1;
      sort(lo, mid);
      sort(mid + 1, hi);
      t.range(lo, hi);
      const buf = a.slice(lo, hi + 1);
      const pEnd = mid - lo, qEnd = hi - lo;
      let p = 0, q = pEnd + 1, k = lo;
      while (p <= pEnd && q <= qEnd) {
        // highlight the slot being filled and the head of the right half
        if (t.cmpv(k, lo + q, buf[p], buf[q], 5)) t.write(k++, buf[p++], 6);
        else t.write(k++, buf[q++], 6);
      }
      while (p <= pEnd) t.write(k++, buf[p++], 7);
      while (q <= qEnd) t.write(k++, buf[q++], 7);
    }
    sort(0, t.n - 1);
  }

  function quick(t) {
    function sort(lo, hi) {
      if (lo >= hi) { if (lo === hi) t.done(lo); return; }
      t.range(lo, hi);
      const mid = (lo + hi) >> 1;
      // median of three, parked at hi
      if (t.less(mid, lo, 2)) t.swap(mid, lo, 2);
      if (t.less(hi, lo, 2)) t.swap(hi, lo, 2);
      if (t.less(mid, hi, 2)) t.swap(mid, hi, 2);
      t.pivot(hi, 3);
      let i = lo;
      for (let j = lo; j < hi; j++) {
        if (t.less(j, hi, 5)) { t.swap(i, j, 6); i++; }
      }
      t.swap(i, hi, 7);
      t.pivot(i, 7);
      t.done(i);
      sort(lo, i - 1);
      sort(i + 1, hi);
    }
    sort(0, t.n - 1);
  }

  function heap(t) {
    const n = t.n;
    function siftDown(r, end) {
      while (2 * r + 1 <= end) {
        let c = 2 * r + 1;
        if (c + 1 <= end && t.less(c, c + 1, 4)) c++;
        if (t.less(r, c, 5)) { t.swap(r, c, 6); r = c; }
        else return;
      }
    }
    t.range(0, n - 1);
    for (let s = (n >> 1) - 1; s >= 0; s--) siftDown(s, n - 1);
    for (let end = n - 1; end > 0; end--) {
      t.swap(0, end, 2);
      t.done(end);
      t.range(0, end - 1);
      siftDown(0, end - 1);
    }
  }

  function radix(t) {
    const n = t.n;
    let max = 0;
    for (let i = 0; i < n; i++) if (t.a[i] > max) max = t.a[i];
    for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
      t.range(0, n - 1);
      const buckets = Array.from({ length: 10 }, () => []);
      for (let i = 0; i < n; i++) {
        const v = t.read(i, 3);
        buckets[Math.floor(v / exp) % 10].push(v);
      }
      let k = 0;
      for (const b of buckets) for (const v of b) t.write(k++, v, 4);
    }
  }

  /* ---------------------------------------------------------------- */

  const ALGOS = {
    bubble: {
      name: 'Bubble sort', run: bubble,
      best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true,
      note: 'Walks the list again and again, swapping neighbours that are out of order. Each pass carries the largest unsorted value to the end. Stops early once a pass makes no swaps.',
      code: [
        'for i ← 0 to n−2',
        '  swapped ← false',
        '  for j ← 0 to n−i−2',
        '    if A[j] > A[j+1]',
        '      swap A[j], A[j+1]; swapped ← true',
        '  if not swapped: stop',
      ],
    },
    cocktail: {
      name: 'Cocktail shaker sort', run: cocktail,
      best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true,
      note: 'Bubble sort that alternates direction. The backward pass moves small values to the front quickly, which bubble sort does one step per pass.',
      code: [
        'lo ← 0; hi ← n−1',
        'repeat',
        '  for j ← lo to hi−1: if A[j] > A[j+1]',
        '    swap A[j], A[j+1]',
        '  hi ← hi − 1',
        '  for j ← hi down to lo+1: if A[j−1] > A[j]',
        '    swap A[j−1], A[j]',
        '  lo ← lo + 1',
        'until a full round makes no swaps',
      ],
    },
    selection: {
      name: 'Selection sort', run: selection,
      best: 'O(n²)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: false,
      note: 'Finds the smallest remaining value and swaps it into the next slot. Always makes about n²/2 comparisons, but never more than n−1 swaps.',
      code: [
        'for i ← 0 to n−2',
        '  min ← i',
        '  for j ← i+1 to n−1',
        '    if A[j] < A[min]',
        '      min ← j',
        '  swap A[i], A[min]',
      ],
    },
    insertion: {
      name: 'Insertion sort', run: insertion,
      best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true,
      note: 'Grows a sorted prefix one item at a time, sliding each new item left until it fits. Excellent on nearly sorted input, which is why real libraries use it for small slices.',
      code: [
        'for i ← 1 to n−1',
        '  j ← i',
        '  while j > 0 and A[j−1] > A[j]',
        '    swap A[j−1], A[j]',
        '    j ← j − 1',
      ],
    },
    shell: {
      name: 'Shell sort', run: shell,
      best: 'O(n log n)', avg: 'O(n^1.25)', worst: 'O(n^1.5)', space: 'O(1)', stable: false,
      note: 'Insertion sort over shrinking gaps (Knuth’s 1, 4, 13, 40 …). Wide gaps move values long distances early, so the final gap-1 pass has very little left to do.',
      code: [
        'h ← 1; while h < n/3: h ← 3h + 1',
        'while h ≥ 1',
        '  for i ← h to n−1',
        '    j ← i; while j ≥ h and A[j−h] > A[j]',
        '      swap A[j−h], A[j]; j ← j − h',
        '  h ← ⌊h / 3⌋',
      ],
    },
    merge: {
      name: 'Merge sort', run: merge,
      best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: true,
      note: 'Sorts each half, then merges the two sorted halves through a buffer. It copies values back rather than swapping them, so the counter shows writes instead of swaps.',
      code: [
        'mergeSort(A, lo, hi)',
        '  if lo ≥ hi: return',
        '  mid ← ⌊(lo+hi)/2⌋',
        '  mergeSort(lo, mid); mergeSort(mid+1, hi)',
        '  B ← copy of A[lo..hi]',
        '  while both halves of B have items',
        '    A[k++] ← smaller of the two heads',
        '  copy what remains into A',
      ],
    },
    quick: {
      name: 'Quicksort', run: quick,
      best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)', stable: false,
      note: 'Picks a pivot (median of three here), moves smaller values to its left, then recurses on each side. The pivot lands in its final slot after every partition.',
      code: [
        'quickSort(A, lo, hi)',
        '  if lo ≥ hi: return',
        '  move median of A[lo], A[mid], A[hi] to A[hi]',
        '  pivot ← A[hi]; i ← lo',
        '  for j ← lo to hi−1',
        '    if A[j] < pivot',
        '      swap A[i], A[j]; i ← i + 1',
        '  swap A[i], A[hi]',
        '  quickSort(lo, i−1); quickSort(i+1, hi)',
      ],
    },
    heap: {
      name: 'Heapsort', run: heap,
      best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)', stable: false,
      note: 'Arranges the array as a max-heap, then repeatedly swaps the root (the largest value) to the end and repairs the heap over what is left.',
      code: [
        'heapSort(A)',
        '  for s ← ⌊n/2⌋−1 down to 0: siftDown(s, n−1)',
        '  for end ← n−1 down to 1: swap A[0], A[end]; siftDown(0, end−1)',
        'siftDown(r, end)',
        '  c ← larger child of r',
        '  if A[r] < A[c]',
        '    swap A[r], A[c]; r ← c',
        '  else return',
      ],
    },
    radix: {
      name: 'Radix sort (LSD)', run: radix,
      best: 'O(d·n)', avg: 'O(d·n)', worst: 'O(d·n)', space: 'O(n + 10)', stable: true,
      note: 'Never compares two values. It deals the numbers into ten buckets by one digit at a time, starting with the ones digit. d is the number of digits in the largest value.',
      code: [
        'for each digit d, least significant first',
        '  buckets ← ten empty lists',
        '  for i ← 0 to n−1',
        '    append A[i] to buckets[digit d of A[i]]',
        '  write buckets 0..9 back into A',
      ],
    },
  };

  function trace(key, input) {
    const algo = ALGOS[key];
    if (!algo) throw new Error('Unknown algorithm: ' + key);
    const t = makeTracer(input);
    algo.run(t);
    t.finish();
    const counts = { c: 0, s: 0, w: 0, r: 0 };
    for (const op of t.ops) if (op.t in counts) counts[op.t]++;
    return { ops: t.ops, result: t.a, counts };
  }

  /* ---------- inputs ---------- */

  function rng(seed) { // mulberry32
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let x = s;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const x = arr[i]; arr[i] = arr[j]; arr[j] = x;
    }
    return arr;
  }

  const PRESETS = {
    random: 'Random',
    nearly: 'Nearly sorted',
    reversed: 'Reversed',
    few: 'Few unique',
  };

  function makeInput(kind, n, seed) {
    const rand = rng(seed);
    const base = Array.from({ length: n }, (_, i) => i + 1);
    switch (kind) {
      case 'nearly': {
        const k = Math.max(1, Math.round(n / 16));
        for (let s = 0; s < k; s++) {
          const i = Math.floor(rand() * n);
          const j = Math.min(n - 1, i + 1 + Math.floor(rand() * 3));
          const x = base[i]; base[i] = base[j]; base[j] = x;
        }
        return base;
      }
      case 'reversed': return base.reverse();
      case 'few': {
        const levels = [0.25, 0.5, 0.75, 1].map((f) => Math.max(1, Math.round(n * f)));
        return base.map(() => levels[Math.floor(rand() * levels.length)]);
      }
      default: return shuffle(base, rand);
    }
  }

  // Parses "5, 3 8,1" into [5,3,8,1]. Returns {values} or {error}.
  function parseCustom(text) {
    const parts = String(text).split(/[\s,;]+/).filter(Boolean);
    if (parts.length < 2) return { error: 'Enter at least two numbers, separated by commas or spaces.' };
    if (parts.length > 256) return { error: 'Use 256 numbers or fewer.' };
    const values = [];
    for (const p of parts) {
      if (!/^\d+$/.test(p)) return { error: `“${p}” is not a whole number. Use whole numbers from 0 to 9999.` };
      const v = Number(p);
      if (v > 9999) return { error: `${p} is too large. Use whole numbers from 0 to 9999.` };
      values.push(v);
    }
    return { values };
  }

  const api = { ALGOS, PRESETS, trace, makeInput, parseCustom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SortBench = api;
})(typeof window !== 'undefined' ? window : globalThis);
