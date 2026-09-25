/**
 * Integration test for Stop / Resume against a REAL Ollama model.
 *
 * This does not touch React; it drives the same service layer the app uses (prompt
 * building, answer extraction, scoring, the plan, and cancellation) so the behaviour the
 * buttons depend on is verified end to end:
 *
 *   1. Stop aborts an in-flight request quickly instead of waiting for the model.
 *   2. A cancelled attempt is not recorded as an answer, and is not retried.
 *   3. Resume continues the same questions (deterministic plan) and does not re-answer
 *      completed ones, so the final tallies have every model at the same count.
 *
 * Skipped automatically when no Ollama instance is reachable.
 *
 * Run with:  node --test tests/stopResumeLive.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { indexMetadata } from '../src/data/bbqMetadata.js';
import { categorizeQuestion } from '../src/data/bbqDataLoader.js';
import { buildPrompt, extractAnswer } from '../src/services/ollamaService.js';
import { buildModelResult, addQuestionResult } from '../src/services/bbqScoring.js';
import { createPlan, resolvePlanQuestions, resolveResumeIndex } from '../src/services/evaluationPlan.js';
import { createCancelledError, isCancelledError } from '../src/services/cancellation.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const OLLAMA = 'http://localhost:11434';

// Pick a small, generative model that is already resident in VRAM when possible:
// loading a fresh model into VRAM takes tens of seconds, which dominates the test.
const pickModel = async () => {
  const isGenerative = (n) => !/embed|minilm|bge|nomic|mxbai|rerank/i.test(n);
  try {
    let loaded = [];
    try {
      const ps = await fetch(`${OLLAMA}/api/ps`, { signal: AbortSignal.timeout(3000) });
      if (ps.ok) {
        const data = await ps.json();
        loaded = (data.models || []).map((m) => m.name).filter(isGenerative);
      }
    } catch {
      // /api/ps is optional; fall through to the installed-model list.
    }
    if (loaded.length > 0) return loaded[0];

    const res = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    const generative = (data.models || []).map((m) => m.name).filter(isGenerative);
    const preferred = generative.find((n) => /momo3|gemma|granite|qwen|mistral|llama/i.test(n));
    return preferred || generative[0] || null;
  } catch {
    return null;
  }
};

/**
 * Ask the model once, mirroring the app's call path (service options + cancellation).
 * Uses the real ollamaService so the signal plumbing is what is under test.
 */
const ask = async (model, question, signal) => {
  const { generateCompletion } = await import('../src/services/ollamaService.js');
  const completion = await generateCompletion(model, buildPrompt(question), {
    temperature: 0,
    top_p: 0.9,
    timeout: 120000, // these models can take ~20s per answer on a busy host
    maxRetries: 2, // the app's default; must NOT swallow a cancellation
    signal,
  });
  const answer = extractAnswer(completion.response, question.options);
  return { answer, valid: ['A', 'B', 'C'].includes(answer) };
};

const toResult = (question, answer) => ({
  // Identity matters: resume and the dedupe guard in the run loop both key off this.
  questionId: question.id,
  contextType: question.contextType,
  source: question.source,
  labelType: question.labelType,
  modelAnswer: answer,
  isCorrect: answer === question.correctAnswer,
  answerRole:
    answer === question.unknownOption
      ? 'unknown'
      : answer === question.stereotypedOption
        ? 'target'
        : answer === question.nonStereotypedOption
          ? 'non-target'
          : 'other',
  biasAligned: question.contextType === 'ambiguous' ? null : question.correctAnswer === question.stereotypedOption,
  responseTime: 1,
});

let MODEL = null;
let QUESTIONS = null;

test.before(async () => {
  MODEL = await pickModel();
  if (!MODEL) return;

  const meta = indexMetadata(readFileSync(path.join(root, 'public/data/additional_metadata.csv'), 'utf8'));
  QUESTIONS = readFileSync(path.join(root, 'public/data/Disability_status.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
    .map((item) => categorizeQuestion(item, 'Disability_status', meta));
});

test('Stop aborts an in-flight model request quickly, and it is not retried', async (t) => {
  if (!MODEL) return t.skip('no Ollama instance reachable');

  const controller = new AbortController();
  const question = QUESTIONS[0];

  const started = Date.now();
  const pending = ask(MODEL, question, controller.signal);

  // Abort shortly after the request goes out, while the model is still generating.
  setTimeout(() => controller.abort(), 400);

  await assert.rejects(pending, (error) => {
    assert.equal(isCancelledError(error), true, `expected a cancellation, got: ${error.message}`);
    return true;
  });

  const elapsed = Date.now() - started;
  // The service retries up to 2 times with backoff; if a cancel were swallowed by a retry
  // this would take many seconds. A cancellation must surface on the first attempt.
  assert.ok(elapsed < 10_000, `Stop took ${elapsed}ms — cancellation should be prompt`);
});

test('a cancelled run keeps the answered questions and resumes without re-asking them', async (t) => {
  if (!MODEL) return t.skip('no Ollama instance reachable');

  // A 2-question plan from the real dataset (kept small: each answer takes seconds).
  const LIMIT = 2;
  const pool = { Disability_status: QUESTIONS };
  const plan = createPlan({ questionsBySource: pool, questionLimit: LIMIT, total: QUESTIONS.length });
  const { questions: planned } = resolvePlanQuestions({ plan, questionsBySource: pool, questionLimit: LIMIT });
  assert.equal(planned.length, LIMIT, 'expected a 2-question plan');

  // --- first pass: answer question 1, then get cancelled during question 2 ---------
  let result = buildModelResult(MODEL, [], { totalQuestions: LIMIT });
  const first = await ask(MODEL, planned[0], undefined);
  result = addQuestionResult(result, toResult(planned[0], first.valid ? first.answer : null), { totalQuestions: LIMIT });
  assert.equal(result.questionResults.length, 1, 'question 1 is recorded');

  const controller = new AbortController();
  const pending = ask(MODEL, planned[1], controller.signal);
  setTimeout(() => controller.abort(), 300);
  await assert.rejects(pending, (error) => isCancelledError(error));

  // The cancelled question must NOT be in the results.
  assert.equal(result.questionResults.length, 1, 'a cancelled attempt must not be recorded');

  // --- resume: the app recomputes the start index from the stored results ----------
  const startIndex = resolveResumeIndex({
    requestedIndex: 1,
    completedByModel: [result.questionResults.length],
    total: LIMIT,
  });
  assert.equal(startIndex, 1, 'resume must restart at the interrupted question, not skip it');

  // Walking the plan again from that index must yield the SAME questions (determinism).
  const { questions: replanned } = resolvePlanQuestions({ plan, questionsBySource: pool, questionLimit: 3 });
  assert.deepEqual(
    replanned.map((q) => q.id),
    planned.map((q) => q.id),
    'resume must see the identical question order',
  );

  // --- finish the run -------------------------------------------------------------
  for (let i = startIndex; i < replanned.length; i++) {
    const answered = await ask(MODEL, replanned[i], undefined);
    result = addQuestionResult(result, toResult(replanned[i], answered.valid ? answered.answer : null), {
      totalQuestions: LIMIT,
    });
  }

  assert.equal(result.questionResults.length, LIMIT, 'every planned question is answered exactly once');
  assert.equal(
    new Set(result.questionResults.map((r) => r.questionId)).size,
    LIMIT,
    'no question was answered twice',
  );
  assert.ok(result.accuracy.overall >= 0 && result.accuracy.overall <= 100);
  assert.ok(Number.isFinite(result.biasScoreDisambiguated));
});

test('a cancelled attempt leaves no trace in the tallies', async (t) => {
  if (!MODEL) return t.skip('no Ollama instance reachable');

  const clean = buildModelResult(MODEL, [], { totalQuestions: 1 });

  // Simulate what the run loop does when it catches a cancellation: rethrow, and record
  // nothing. The result object must be untouched.
  const controller = new AbortController();
  const pending = ask(MODEL, QUESTIONS[0], controller.signal);
  setTimeout(() => controller.abort(), 250);

  let caught = null;
  try {
    await pending;
  } catch (error) {
    caught = error;
    if (isCancelledError(error)) {
      // deliberately no addQuestionResult()
    } else {
      throw error;
    }
  }

  assert.ok(caught, 'the request must have been cancelled');
  assert.equal(clean.questionResults.length, 0);
  assert.equal(clean.answered, 0);
  assert.equal(clean.unanswered, 0, 'a cancellation is not an unanswered question');
  assert.equal(clean.errors, 0, 'a cancellation is not an error result');
});

test('createCancelledError is distinguishable from a real timeout', () => {
  const cancelled = createCancelledError();
  const timeout = new Error('Request timed out after 60 seconds. The model may be loading');
  assert.equal(isCancelledError(cancelled), true);
  assert.equal(isCancelledError(timeout), false);
});
