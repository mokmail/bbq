/**
 * End-to-end pipeline test: raw BBQ data -> normalised questions -> simulated model
 * answers -> paper metrics.
 *
 * This is the test that would have caught the original bug: with the old hardcoded
 * `stereotypedOption: 'B' / unknownOption: 'A'` constants, a model that always answers
 * correctly would NOT score 100 % accuracy on the real data.
 *
 * Run with:  npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { categorizeQuestion } from '../src/data/bbqDataLoader.js';
import { indexMetadata, metadataKey } from '../src/data/bbqMetadata.js';
import { buildModelResult, addQuestionResult } from '../src/services/bbqScoring.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const METADATA = indexMetadata(
  readFileSync(path.join(root, 'public/data/additional_metadata.csv'), 'utf8'),
);

const loadQuestions = (file, category) =>
  readFileSync(path.join(root, 'public/data', file), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
    .map((item) => {
      const meta = METADATA.byKey.get(
        metadataKey(item.category, item.question_index, item.example_id),
      );
      const question = categorizeQuestion(item, category, METADATA);
      return { ...question, metaRecord: meta };
    });

const CATEGORY_FILES = [
  ['Religion.jsonl', 'Religion'],
  ['Age.jsonl', 'Age'],
  ['Nationality.jsonl', 'Nationality'],
  ['Sexual_orientation.jsonl', 'Sexual_orientation'],
  ['Disability_status.jsonl', 'Disability_status'],
  ['Physical_appearance.jsonl', 'Physical_appearance'],
];

const simulate = (question, strategy) => {
  const answer = strategy(question);
  const isCorrect = answer === question.correctAnswer;
  const answerRole =
    answer === question.unknownOption
      ? 'unknown'
      : answer === question.stereotypedOption
        ? 'target'
        : answer === question.nonStereotypedOption
          ? 'non-target'
          : 'other';

  return {
    questionId: question.id,
    source: question.source,
    task: question.task,
    labelType: question.labelType,
    contextType: question.contextType,
    modelAnswer: answer,
    isCorrect,
    answerRole,
    biasAligned:
      question.contextType === 'disambiguated' && isCorrect
        ? answer === question.stereotypedOption
        : null,
    responseTime: 10,
    error: false,
  };
};

test('a perfect model scores 100 % accuracy and ~0 bias on real data', () => {
  const questions = CATEGORY_FILES.flatMap(([file, category]) => loadQuestions(file, category));
  assert.ok(questions.length > 11000, `expected a large sample, got ${questions.length}`);

  const results = questions.map((question) =>
    simulate(question, (q) => q.correctAnswer),
  );
  const model = buildModelResult('oracle', results);

  assert.equal(model.accuracy.overall, 100);
  assert.equal(model.unanswered, 0);
  assert.equal(model.incorrect, 0);
  assert.equal(model.biasScoreAmbiguous, 0);
  // A perfect model answers the target on the ~half of disambiguated questions where the
  // correct answer is the bias target -> also ~0 overall.
  assert.ok(
    Math.abs(model.biasScoreDisambiguated) < 0.05,
    `s_dis should be ~0, got ${model.biasScoreDisambiguated}`,
  );
  assert.equal(model.alignmentCost, 0);
});

test('a stereotype-following model is detected on real data', () => {
  const questions = CATEGORY_FILES.flatMap(([file, category]) => loadQuestions(file, category));

  // Always name the bias target, whatever the context says.
  const results = questions.map((question) =>
    simulate(question, (q) => q.stereotypedOption),
  );
  const model = buildModelResult('biased', results);

  // In ambiguous contexts the correct answer is always "unknown", so accuracy is 0 and
  // every non-unknown answer is the bias target -> s_amb = (1 - 0) * 1 = 1.
  assert.equal(model.accuracy.ambiguous, 0);
  assert.ok(
    model.biasScoreAmbiguous > 0.99,
    `s_amb should be ~1, got ${model.biasScoreAmbiguous}`,
  );
  assert.equal(model.biasScoreDisambiguated, 1);
  // Answers are right only when the correct answer happens to be the target.
  assert.ok(model.accuracy.disambiguated > 40 && model.accuracy.disambiguated < 60);
});

test('an always-unknown model has 0 bias and 50 % accuracy', () => {
  const questions = CATEGORY_FILES.flatMap(([file, category]) => loadQuestions(file, category));
  const results = questions.map((question) =>
    simulate(question, (q) => q.unknownOption),
  );
  const model = buildModelResult('abstainer', results);

  // Ambiguous questions are answered correctly, disambiguated ones are not.
  assert.equal(model.accuracy.ambiguous, 100);
  assert.equal(model.biasScoreAmbiguous, 0);
  assert.equal(model.biasScoreDisambiguated, 0);
  assert.ok(Math.abs(model.accuracy.overall - 50) < 1);
});

test('answer distribution is counted against the real option roles', () => {
  const questions = loadQuestions('Religion.jsonl', 'Religion');
  const model = buildModelResult(
    'mixed',
    questions.map((question) => simulate(question, (q) => q.stereotypedOption)),
  );

  const counts = model.counts;
  assert.equal(counts.target + counts.nonTarget + counts.unknown + counts.other, model.answered);
  assert.equal(counts.unknown, 0);
  assert.equal(counts.target, model.answered);
});

test('incremental accumulation equals a batch recomputation', () => {
  const questions = loadQuestions('Age.jsonl', 'Age').slice(0, 400);
  const results = questions.map((question, index) =>
    simulate(question, (q) =>
      index % 3 === 0 ? q.correctAnswer : index % 3 === 1 ? q.stereotypedOption : q.unknownOption,
    ),
  );

  const batch = buildModelResult('Age', results);
  let incremental = buildModelResult('Age', []);
  results.forEach((result) => {
    incremental = addQuestionResult(incremental, result);
  });

  assert.equal(incremental.accuracy.overall, batch.accuracy.overall);
  assert.equal(incremental.biasScoreAmbiguous, batch.biasScoreAmbiguous);
  assert.equal(incremental.biasScoreDisambiguated, batch.biasScoreDisambiguated);
  assert.equal(incremental.correct, batch.correct);
  assert.equal(incremental.taskAccuracy.Age, batch.taskAccuracy.Age);
});

test('resuming from a serialised result keeps the metrics correct', () => {
  const questions = loadQuestions('SES.jsonl', 'SES').slice(0, 200);
  const results = questions.map((question) => simulate(question, (q) => q.correctAnswer));

  const firstHalf = buildModelResult('SES', []);
  let partial = firstHalf;
  results.slice(0, 100).forEach((result) => {
    partial = addQuestionResult(partial, result);
  });

  // Simulate a localStorage round-trip: the accumulator is gone, only plain data remains.
  const rehydrated = JSON.parse(JSON.stringify(partial));
  assert.equal(Object.getOwnPropertySymbols(rehydrated).length, 0);

  let resumed = rehydrated;
  results.slice(100).forEach((result) => {
    resumed = addQuestionResult(resumed, result);
  });

  const complete = buildModelResult('SES', results);
  assert.equal(resumed.correct, complete.correct);
  assert.equal(resumed.accuracy.overall, complete.accuracy.overall);
  assert.equal(resumed.biasScoreAmbiguous, complete.biasScoreAmbiguous);
  assert.equal(resumed.questionResults.length, complete.questionResults.length);
});

test('questions carry the per-example option roles used for scoring', () => {
  const questions = loadQuestions('Gender_identity.jsonl', 'Gender_identity');
  const sample = questions.slice(0, 200);

  sample.forEach((question) => {
    assert.ok(['A', 'B', 'C'].includes(question.correctAnswer));
    assert.ok(['A', 'B', 'C'].includes(question.stereotypedOption));
    assert.ok(['A', 'B', 'C'].includes(question.unknownOption));
    // The three roles must be three different options.
    assert.equal(
      new Set([question.stereotypedOption, question.nonStereotypedOption, question.unknownOption])
        .size,
      3,
      `${question.id} roles must be distinct`,
    );
    // The options shown to the model start with the letter they are indexed by.
    question.options.forEach((option, index) => {
      assert.equal(option.slice(0, 1), 'ABC'[index]);
    });
  });
});

test('the unknown option is the answer in every ambiguous question', () => {
  const questions = loadQuestions('Religion.jsonl', 'Religion').filter(
    (question) => question.contextType === 'ambiguous',
  );
  assert.ok(questions.length > 500);
  questions.forEach((question) => {
    assert.equal(question.correctAnswer, question.unknownOption);
  });
});
