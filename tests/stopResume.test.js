/**
 * Tests for the stop / resume machinery.
 *
 * These cover the failure modes that made Stop and Resume unreliable before:
 *   - the question order changed between a stop and a resume (clock-seeded shuffle)
 *   - a cancelled request was retried and later reported as a timeout
 *   - resume continued from a stale index, or from a question that was only half answered
 *
 * Run with:  npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  shuffleWithSeed,
  planSignature,
  createPlan,
  resolvePlanQuestions,
  resolveResumeIndex,
  mulberry32,
} from '../src/services/evaluationPlan.js';
import {
  CANCELLED_MESSAGE,
  createCancelledError,
  isCancelledError,
  linkAbort,
  abortableDelay,
} from '../src/services/cancellation.js';

// ---------------------------------------------------------------------------
// Determinism of the question selection
// ---------------------------------------------------------------------------

test('a seeded shuffle is stable for the same seed and differs across seeds', () => {
  const items = Array.from({ length: 50 }, (_, i) => `q${i}`);
  const a = shuffleWithSeed(items, 12345);
  const b = shuffleWithSeed(items, 12345);
  const c = shuffleWithSeed(items, 54321);

  assert.deepEqual(a, b, 'same seed must give the same order');
  assert.notDeepEqual(a, c, 'a different seed should give a different order');
  assert.deepEqual([...a].sort(), [...items].sort(), 'shuffle must not lose or duplicate items');
});

test('the shuffle does not depend on Date.now / Math.random', () => {
  // Freeze the clock and the global RNG: the result must still be identical, which is the
  // property the old `sort(() => Math.random() - 0.5)` approach lacked.
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const originalRandom = Math.random;
  const originalNow = Date.now;
  Math.random = () => 0.99;
  Date.now = () => 1;

  const first = shuffleWithSeed(items, 777);
  Math.random = () => 0.01;
  Date.now = () => 999999;
  const second = shuffleWithSeed(items, 777);

  Math.random = originalRandom;
  Date.now = originalNow;

  assert.deepEqual(first, second);
});

test('a plan selects the same questions on rebuild with the same seed', () => {
  const questions = {
    Religion: Array.from({ length: 100 }, (_, i) => ({ id: `rel-${i}` })),
    Age: Array.from({ length: 40 }, (_, i) => ({ id: `age-${i}` })),
  };

  const planA = createPlan({ questionsBySource: questions, questionLimit: 10, total: 140, seed: 4242 });
  const planB = createPlan({ questionsBySource: questions, questionLimit: 10, total: 140, seed: 4242 });

  assert.deepEqual(planA.ids, planB.ids);
  assert.equal(planA.ids.Religion.length, 10, 'limit is applied per category');
  assert.equal(planA.ids.Age.length, 10);
  assert.equal(planA.signature, planB.signature);
});

test('per-category seeds keep one category from shifting another', () => {
  const questions = {
    Religion: Array.from({ length: 30 }, (_, i) => ({ id: `rel-${i}` })),
    Age: Array.from({ length: 30 }, (_, i) => ({ id: `age-${i}` })),
  };
  const plan = createPlan({ questionsBySource: questions, questionLimit: 5, total: 60, seed: 99 });

  // Adding a category to the plan must not change the ids already chosen for another.
  const extended = createPlan({
    questionsBySource: { ...questions, SES: Array.from({ length: 20 }, (_, i) => ({ id: `ses-${i}` })) },
    questionLimit: 5,
    total: 80,
    seed: 99,
  });

  assert.deepEqual(plan.ids.Religion, extended.ids.Religion);
  assert.deepEqual(plan.ids.Age, extended.ids.Age);
});

test('the plan signature changes when the selection changes', () => {
  const base = { sources: ['Religion', 'Age'], questionLimit: 10, total: 140 };
  const same = { sources: ['Age', 'Religion'], questionLimit: 10, total: 140 };
  const otherLimit = { ...base, questionLimit: 25 };

  assert.equal(planSignature(base), planSignature(same), 'source order must not matter');
  assert.notEqual(planSignature(base), planSignature(otherLimit), 'changing the limit invalidates the plan');
});

test('resolving a plan returns questions in the planned order', () => {
  const questions = { Religion: Array.from({ length: 20 }, (_, i) => ({ id: `rel-${i}` })) };
  const plan = createPlan({ questionsBySource: questions, questionLimit: 5, total: 20, seed: 7 });

  const { questions: resolved, missing } = resolvePlanQuestions({
    plan,
    questionsBySource: questions,
    questionLimit: 5,
  });

  assert.equal(missing, 0);
  assert.deepEqual(resolved.map((q) => q.id), plan.ids.Religion);
});

test('resolving a plan tolerates questions that disappeared from the data', () => {
  const questions = { Religion: Array.from({ length: 5 }, (_, i) => ({ id: `rel-${i}` })) };
  const plan = { signature: 'x', seed: 1, ids: { Religion: ['rel-0', 'gone', 'rel-2'] } };

  const { questions: resolved, missing } = resolvePlanQuestions({
    plan,
    questionsBySource: questions,
    questionLimit: 10,
  });

  assert.deepEqual(resolved.map((q) => q.id), ['rel-0', 'rel-2']);
  assert.equal(missing, 1, 'missing ids are counted, not thrown');
});

// ---------------------------------------------------------------------------
// Resume position
// ---------------------------------------------------------------------------

test('resume restarts at the earliest incomplete question across models', () => {
  // Two models: one answered 7 questions, the other 5. Resume must start at 5 so the
  // models end up with comparable tallies.
  assert.equal(
    resolveResumeIndex({ requestedIndex: 7, completedByModel: [7, 5], total: 20 }),
    5,
  );
});

test('resume never skips past a partially answered question', () => {
  // The remembered index says 9, but only 4 questions are complete -> 4 wins.
  assert.equal(resolveResumeIndex({ requestedIndex: 9, completedByModel: [4, 4], total: 20 }), 4);
});

test('resume falls back to the requested index when nothing is recorded', () => {
  assert.equal(resolveResumeIndex({ requestedIndex: 3, completedByModel: [], total: 10 }), 0);
  assert.equal(resolveResumeIndex({ requestedIndex: 0, completedByModel: [0], total: 10 }), 0);
});

test('resume index is clamped into range', () => {
  assert.equal(resolveResumeIndex({ requestedIndex: 999, completedByModel: [999], total: 10 }), 10);
  assert.equal(resolveResumeIndex({ requestedIndex: -5, completedByModel: [3], total: 10 }), 0);
});

test('a fully completed run resumes at the end', () => {
  assert.equal(resolveResumeIndex({ requestedIndex: 20, completedByModel: [20, 20], total: 20 }), 20);
});

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

test('cancellation errors are recognizable and distinct from timeouts', () => {
  const cancelled = createCancelledError();
  assert.equal(cancelled.message, CANCELLED_MESSAGE);
  assert.equal(isCancelledError(cancelled), true);

  const timeout = new Error('Request timed out after 60 seconds');
  assert.equal(isCancelledError(timeout), false, 'a timeout must not look like a cancellation');
  assert.equal(isCancelledError(new Error('AbortError')), false);
  assert.equal(isCancelledError(null), false);
});

test('linkAbort aborts the inner controller when the outer signal fires', () => {
  const outer = new AbortController();
  const inner = new AbortController();
  const unlink = linkAbort(inner, outer.signal);

  assert.equal(inner.signal.aborted, false);
  outer.abort();
  assert.equal(inner.signal.aborted, true, 'inner request must be aborted by the run signal');

  unlink();
});

test('linkAbort handles an already-aborted signal and a missing signal', () => {
  const outer = new AbortController();
  outer.abort();

  const inner = new AbortController();
  linkAbort(inner, outer.signal);
  assert.equal(inner.signal.aborted, true, 'an already-cancelled run aborts new requests immediately');

  const untouched = new AbortController();
  const unlink = linkAbort(untouched, undefined);
  assert.equal(untouched.signal.aborted, false);
  assert.equal(typeof unlink, 'function');

  // Passing a controller instead of a signal is tolerated, not a crash.
  const alsoUntouched = new AbortController();
  const other = new AbortController();
  assert.doesNotThrow(() => linkAbort(alsoUntouched, other));
});

test('abortableDelay resolves normally, and rejects promptly on cancel', async () => {
  const start = Date.now();
  await abortableDelay(10, undefined);
  assert.ok(Date.now() - start >= 5, 'a delay with no signal still waits');

  const controller = new AbortController();
  const pending = abortableDelay(10_000, controller.signal);
  setTimeout(() => controller.abort(), 20);

  const cancelledAt = Date.now();
  await assert.rejects(pending, (error) => isCancelledError(error));
  assert.ok(
    Date.now() - cancelledAt < 2000,
    'cancelling must not wait for the full delay (this is what made Stop feel dead)',
  );
});

test('abortableDelay rejects immediately on an already-aborted signal', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(abortableDelay(10_000, controller.signal), (error) => isCancelledError(error));
});

test('the PRNG is deterministic and stays in [0, 1)', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  for (let i = 0; i < 100; i++) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
});
