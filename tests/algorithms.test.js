// Run with: npm test   (Node 18+, no dependencies)
const test = require('node:test');
const assert = require('node:assert/strict');
const { ALGOS, PRESETS, trace, makeInput, parseCustom } = require('../js/algorithms.js');

// Replays an op list the same way the UI does and returns the final state.
function replay(input, ops) {
  const a = input.slice();
  const done = new Array(a.length).fill(false);
  for (const op of ops) {
    if (op.t === 's') { const x = a[op.i]; a[op.i] = a[op.j]; a[op.j] = x; }
    else if (op.t === 'w') a[op.i] = op.v;
    else if (op.t === 'd') done[op.i] = true;
  }
  return { a, done };
}

const sorted = (arr) => arr.slice().sort((x, y) => x - y);
const sizes = [2, 3, 7, 16, 48, 129];

for (const key of Object.keys(ALGOS)) {
  test(`${key}: sorts every preset and the replay matches`, () => {
    for (const kind of Object.keys(PRESETS)) {
      for (const n of sizes) {
        const input = makeInput(kind, n, 42 + n);
        const { ops, result } = trace(key, input);
        assert.deepEqual(result, sorted(input), `${kind}, n=${n}`);
        const r = replay(input, ops);
        assert.deepEqual(r.a, result, `replay ${kind}, n=${n}`);
        assert.ok(r.done.every(Boolean), `every bar marked sorted (${kind}, n=${n})`);
      }
    }
  });

  test(`${key}: handles duplicates, zeros and already-sorted input`, () => {
    for (const input of [[0, 0], [5, 0, 5, 0, 5], [1, 2, 3, 4, 5], [9999, 1, 250, 250, 3]]) {
      assert.deepEqual(trace(key, input).result, sorted(input));
    }
  });

  test(`${key}: every op points inside the array`, () => {
    const input = makeInput('random', 40, 7);
    for (const op of trace(key, input).ops) {
      for (const f of ['i', 'j']) if (f in op) assert.ok(op[f] >= 0 && op[f] < 40, JSON.stringify(op));
    }
  });
}

test('radix sort makes no comparisons', () => {
  assert.equal(trace('radix', makeInput('random', 64, 1)).counts.c, 0);
});

test('selection sort makes at most n−1 swaps', () => {
  assert.ok(trace('selection', makeInput('random', 64, 3)).counts.s <= 63);
});

test('insertion sort is linear on sorted input', () => {
  assert.equal(trace('insertion', [1, 2, 3, 4, 5]).counts.s, 0);
});

test('same seed gives the same input', () => {
  assert.deepEqual(makeInput('random', 32, 9), makeInput('random', 32, 9));
});

test('parseCustom accepts lists and explains bad input', () => {
  assert.deepEqual(parseCustom('5, 3 8;1').values, [5, 3, 8, 1]);
  assert.match(parseCustom('4').error, /at least two/);
  assert.match(parseCustom('3, x').error, /not a whole number/);
  assert.match(parseCustom('3, 10000').error, /too large/);
});
